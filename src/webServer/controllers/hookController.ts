import prisma from '../../services/prisma';
import { CustomRequestHandler } from '../../types/express';
import { Prisma } from '@prisma/client';
import { UserService } from '../../services/users/userService';

const userService = new UserService();

/**
 * Hook controller
 *
 * A Hook is the universal scheduling primitive (meeting / service / listing).
 * See prisma `Hook` model and docs/catch-upgrade for product logic.
 */

const ACCESS_LEVELS = ['personal', 'open', 'shared', 'private'] as const;
const STATES = ['active', 'paused'] as const;
const LOCATION_TYPES = ['remote', 'in_person'] as const;

type AccessLevel = (typeof ACCESS_LEVELS)[number];

// What we include whenever returning a hook to the client.
const hookInclude = {
  participants: {
    include: {
      user: { select: { id: true, name: true, avatar: true, accountType: true } }
    }
  },
  availabilitySlots: { orderBy: { weekday: 'asc' } },
  owner: { select: { id: true, name: true, avatar: true, accountType: true } }
} satisfies Prisma.HookInclude;

interface NormalizedSlot {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  isAvailable: boolean;
  isPaused: boolean;
}

/** Validate + de-dupe a weekly availability array (one entry per weekday 0-6). */
function normalizeAvailability(slots: unknown): NormalizedSlot[] {
  if (!Array.isArray(slots)) return [];
  const seen = new Set<number>();
  const out: NormalizedSlot[] = [];
  for (const s of slots) {
    const weekday = Number(s?.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || seen.has(weekday)) continue;
    const startMinutes = Number.isInteger(s?.startMinutes) ? s.startMinutes : 540;
    const endMinutes = Number.isInteger(s?.endMinutes) ? s.endMinutes : 1020;
    if (startMinutes >= endMinutes) continue;
    seen.add(weekday);
    out.push({
      weekday,
      startMinutes,
      endMinutes,
      isAvailable: s?.isAvailable !== false,
      isPaused: !!s?.isPaused
    });
  }
  return out;
}

type HookWithRelations = Prisma.HookGetPayload<{ include: typeof hookInclude }>;

/**
 * Derive the My-Hooks group for a hook. Paused always wins; otherwise the
 * group follows the access level. (Pending / confirmed booking groups are a
 * dashboard concern, computed from MomentRequests, not here.)
 */
function deriveGroup(hook: { state: string; accessLevel: string }): string {
  if (hook.state === 'paused') return 'paused';
  switch (hook.accessLevel) {
    case 'open':
      return 'open';
    case 'shared':
      return 'shared';
    case 'private':
      return 'private';
    default:
      return 'personal';
  }
}

function shapeHook(hook: HookWithRelations, viewerId: string) {
  const acceptedParticipants = hook.participants.filter((p) => p.status === 'accepted');
  return {
    ...hook,
    isOwner: hook.ownerId === viewerId,
    group: deriveGroup(hook),
    participantCount: acceptedParticipants.length,
    priceDisplay:
      hook.isPaid && hook.priceCents != null
        ? `${hook.currency} ${(hook.priceCents / 100).toFixed(2)}`
        : null
  };
}

/** Validate + normalize price fields. Returns an error string or null. */
function validatePrice(isPaid: boolean, priceCents: unknown): string | null {
  if (!isPaid) return null;
  if (typeof priceCents !== 'number' || !Number.isInteger(priceCents) || priceCents <= 0) {
    return 'priceCents must be a positive integer when isPaid is true';
  }
  return null;
}

/**
 * List the authenticated user's hooks (owned + shared hooks they have accepted).
 * Supports ?accessLevel= and ?state= filters and returns hooks grouped.
 */
export const getHooks: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { accessLevel, state, grouped } = req.query as Record<string, string | undefined>;

    if (accessLevel && !ACCESS_LEVELS.includes(accessLevel as AccessLevel)) {
      return res.status(400).json({ error: `accessLevel must be one of ${ACCESS_LEVELS.join(', ')}` });
    }
    if (state && !STATES.includes(state as (typeof STATES)[number])) {
      return res.status(400).json({ error: `state must be one of ${STATES.join(', ')}` });
    }

    const ownerWhere: Prisma.HookWhereInput = { ownerId: userId };
    if (accessLevel) ownerWhere.accessLevel = accessLevel;
    if (state) ownerWhere.state = state;

    const owned = await prisma.hook.findMany({
      where: ownerWhere,
      include: hookInclude,
      orderBy: { updatedAt: 'desc' }
    });

    // Shared hooks the user has accepted into their My Hooks.
    const participations = await prisma.hookParticipant.findMany({
      where: {
        userId,
        status: 'accepted',
        hook: { accessLevel: 'shared', ownerId: { not: userId } }
      },
      include: { hook: { include: hookInclude } }
    });

    const sharedHooks = participations
      .map((p) => p.hook)
      .filter((h): h is HookWithRelations => h !== null)
      .filter((h) => (!accessLevel || h.accessLevel === accessLevel) && (!state || h.state === state));

    const allHooks = [...owned, ...sharedHooks].map((h) => shapeHook(h, userId));

    if (grouped === 'true') {
      const groups: Record<string, ReturnType<typeof shapeHook>[]> = {
        open: [],
        shared: [],
        private: [],
        personal: [],
        paused: []
      };
      for (const h of allHooks) {
        (groups[h.group] ||= []).push(h);
      }
      return res.json({ groups });
    }

    return res.json({ hooks: allHooks });
  } catch (error) {
    console.error('Error listing hooks:', error);
    return res.status(500).json({ error: 'Failed to list hooks' });
  }
};

/** Get a single hook the user can see (owner, accepted participant, or open). */
export const getHook: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const hook = await prisma.hook.findUnique({ where: { id }, include: hookInclude });
    if (!hook) return res.status(404).json({ error: 'Hook not found' });

    const isOwner = hook.ownerId === userId;
    const isParticipant = hook.participants.some(
      (p) => p.userId === userId && p.status === 'accepted'
    );
    const isOpen = hook.accessLevel === 'open' && hook.state === 'active';

    if (!isOwner && !isParticipant && !isOpen) {
      return res.status(403).json({ error: 'You do not have permission to view this hook' });
    }

    return res.json({ hook: shapeHook(hook, userId) });
  } catch (error) {
    console.error('Error getting hook:', error);
    return res.status(500).json({ error: 'Failed to get hook' });
  }
};

/** Create a hook. */
export const createHook: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      title,
      description,
      icon,
      meetingType,
      category,
      accessLevel = 'personal',
      state = 'active',
      locationType = 'remote',
      locationLabel,
      locationAddress,
      locationLatitude,
      locationLongitude,
      durationMinutes = 30,
      capacity,
      isPaid = false,
      priceCents,
      currency = 'USD',
      publishedToMesh = false,
      participantUserIds,
      availabilitySlots
    } = req.body ?? {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!ACCESS_LEVELS.includes(accessLevel)) {
      return res.status(400).json({ error: `accessLevel must be one of ${ACCESS_LEVELS.join(', ')}` });
    }
    if (!STATES.includes(state)) {
      return res.status(400).json({ error: `state must be one of ${STATES.join(', ')}` });
    }
    if (!LOCATION_TYPES.includes(locationType)) {
      return res.status(400).json({ error: `locationType must be one of ${LOCATION_TYPES.join(', ')}` });
    }
    if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
      return res.status(400).json({ error: 'durationMinutes must be a positive number' });
    }
    if (capacity != null && (!Number.isInteger(capacity) || capacity <= 0)) {
      return res.status(400).json({ error: 'capacity must be a positive integer' });
    }
    const priceError = validatePrice(!!isPaid, priceCents);
    if (priceError) return res.status(400).json({ error: priceError });

    const slots = normalizeAvailability(availabilitySlots);

    // Only business accounts may publish hooks to Mesh.
    let mesh = !!publishedToMesh;
    if (mesh) {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { accountType: true } });
      if (me?.accountType !== 'business') mesh = false;
    }

    // Validate participants (must be contacts of the creator). Only relevant for shared hooks.
    let participantData: Prisma.HookParticipantCreateWithoutHookInput[] = [];
    if (Array.isArray(participantUserIds) && participantUserIds.length > 0) {
      const contacts = await prisma.contact.findMany({
        where: { ownerId: userId, contactUserId: { in: participantUserIds } },
        include: { contactUser: { select: { id: true, name: true } } }
      });
      participantData = contacts
        .filter((c) => c.contactUserId)
        .map((c) => ({
          user: { connect: { id: c.contactUserId! } },
          displayName: c.displayName,
          contactPhone: c.contactPhone,
          // Shared hooks invite; other access levels add directly.
          status: accessLevel === 'shared' ? 'invited' : 'accepted'
        }));
    }

    const hook = await prisma.hook.create({
      data: {
        ownerId: userId,
        title: title.trim(),
        description: description ?? null,
        icon: icon ?? null,
        meetingType: meetingType ?? null,
        category: category ?? null,
        accessLevel,
        state,
        locationType,
        locationLabel: locationType === 'in_person' ? locationLabel ?? null : null,
        locationAddress: locationType === 'in_person' ? locationAddress ?? null : null,
        locationLatitude: locationType === 'in_person' ? locationLatitude ?? null : null,
        locationLongitude: locationType === 'in_person' ? locationLongitude ?? null : null,
        durationMinutes,
        capacity: capacity ?? null,
        isPaid: !!isPaid,
        priceCents: isPaid ? priceCents : null,
        currency,
        publishedToMesh: mesh,
        participants: participantData.length ? { create: participantData } : undefined,
        availabilitySlots: slots.length ? { create: slots } : undefined
      },
      include: hookInclude
    });

    return res.status(201).json({ message: 'Hook created successfully', hook: shapeHook(hook, userId) });
  } catch (error) {
    console.error('Error creating hook:', error);
    return res.status(500).json({ error: 'Failed to create hook' });
  }
};

/** Update a hook (owner only). */
export const updateHook: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await prisma.hook.findFirst({ where: { id, ownerId: userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Hook not found or you do not have permission to edit it' });
    }

    const data: Prisma.HookUpdateInput = {};
    const b = req.body ?? {};

    if (b.title !== undefined) {
      if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: 'title cannot be empty' });
      data.title = String(b.title).trim();
    }
    if (b.description !== undefined) data.description = b.description;
    if (b.icon !== undefined) data.icon = b.icon;
    if (b.meetingType !== undefined) data.meetingType = b.meetingType;
    if (b.category !== undefined) data.category = b.category;
    if (b.accessLevel !== undefined) {
      if (!ACCESS_LEVELS.includes(b.accessLevel)) {
        return res.status(400).json({ error: `accessLevel must be one of ${ACCESS_LEVELS.join(', ')}` });
      }
      data.accessLevel = b.accessLevel;
    }
    if (b.state !== undefined) {
      if (!STATES.includes(b.state)) return res.status(400).json({ error: `state must be one of ${STATES.join(', ')}` });
      data.state = b.state;
    }
    if (b.locationType !== undefined) {
      if (!LOCATION_TYPES.includes(b.locationType)) {
        return res.status(400).json({ error: `locationType must be one of ${LOCATION_TYPES.join(', ')}` });
      }
      data.locationType = b.locationType;
      if (b.locationType === 'remote') {
        data.locationLabel = null;
        data.locationAddress = null;
        data.locationLatitude = null;
        data.locationLongitude = null;
      }
    }
    if (b.locationLabel !== undefined) data.locationLabel = b.locationLabel;
    if (b.locationAddress !== undefined) data.locationAddress = b.locationAddress;
    if (b.locationLatitude !== undefined) data.locationLatitude = b.locationLatitude;
    if (b.locationLongitude !== undefined) data.locationLongitude = b.locationLongitude;
    if (b.durationMinutes !== undefined) {
      if (typeof b.durationMinutes !== 'number' || b.durationMinutes <= 0) {
        return res.status(400).json({ error: 'durationMinutes must be a positive number' });
      }
      data.durationMinutes = b.durationMinutes;
    }
    if (b.capacity !== undefined) {
      if (b.capacity !== null && (!Number.isInteger(b.capacity) || b.capacity <= 0)) {
        return res.status(400).json({ error: 'capacity must be a positive integer' });
      }
      data.capacity = b.capacity;
    }
    if (b.availabilitySlots !== undefined) {
      // Replace the whole weekly schedule.
      data.availabilitySlots = { deleteMany: {}, create: normalizeAvailability(b.availabilitySlots) };
    }

    // Pricing: keep isPaid and priceCents consistent.
    const nextIsPaid = b.isPaid !== undefined ? !!b.isPaid : existing.isPaid;
    if (b.isPaid !== undefined || b.priceCents !== undefined) {
      const nextPrice = b.priceCents !== undefined ? b.priceCents : existing.priceCents;
      const priceError = validatePrice(nextIsPaid, nextPrice);
      if (priceError) return res.status(400).json({ error: priceError });
      data.isPaid = nextIsPaid;
      data.priceCents = nextIsPaid ? nextPrice : null;
    }
    if (b.currency !== undefined) data.currency = b.currency;

    if (b.publishedToMesh !== undefined) {
      let mesh = !!b.publishedToMesh;
      if (mesh) {
        const me = await prisma.user.findUnique({ where: { id: userId }, select: { accountType: true } });
        if (me?.accountType !== 'business') mesh = false;
      }
      data.publishedToMesh = mesh;
    }

    const hook = await prisma.hook.update({ where: { id }, data, include: hookInclude });
    return res.json({ message: 'Hook updated successfully', hook: shapeHook(hook, userId) });
  } catch (error) {
    console.error('Error updating hook:', error);
    return res.status(500).json({ error: 'Failed to update hook' });
  }
};

/** Set hook lifecycle state (pause / resume), owner only. */
export const setHookState: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { state } = req.body ?? {};

    if (!STATES.includes(state)) {
      return res.status(400).json({ error: `state must be one of ${STATES.join(', ')}` });
    }

    const existing = await prisma.hook.findFirst({ where: { id, ownerId: userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Hook not found or you do not have permission to edit it' });
    }

    const hook = await prisma.hook.update({ where: { id }, data: { state }, include: hookInclude });
    return res.json({ message: `Hook ${state === 'paused' ? 'paused' : 'resumed'}`, hook: shapeHook(hook, userId) });
  } catch (error) {
    console.error('Error setting hook state:', error);
    return res.status(500).json({ error: 'Failed to update hook state' });
  }
};

/** Delete a hook (owner only). */
export const deleteHook: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await prisma.hook.findFirst({ where: { id, ownerId: userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Hook not found or you do not have permission to delete it' });
    }

    await prisma.hook.delete({ where: { id } });
    return res.json({ message: 'Hook deleted successfully' });
  } catch (error) {
    console.error('Error deleting hook:', error);
    return res.status(500).json({ error: 'Failed to delete hook' });
  }
};

/** Owner invites contacts to a (shared) hook. */
export const inviteParticipants: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { participantUserIds } = req.body ?? {};

    if (!Array.isArray(participantUserIds) || participantUserIds.length === 0) {
      return res.status(400).json({ error: 'participantUserIds (non-empty array) is required' });
    }

    const hook = await prisma.hook.findFirst({ where: { id, ownerId: userId } });
    if (!hook) {
      return res.status(404).json({ error: 'Hook not found or you do not have permission to edit it' });
    }

    const contacts = await prisma.contact.findMany({
      where: { ownerId: userId, contactUserId: { in: participantUserIds } }
    });
    const status = hook.accessLevel === 'shared' ? 'invited' : 'accepted';

    await prisma.$transaction(
      contacts
        .filter((c) => c.contactUserId)
        .map((c) =>
          prisma.hookParticipant.upsert({
            where: { hookId_userId: { hookId: id, userId: c.contactUserId! } },
            create: {
              hookId: id,
              userId: c.contactUserId!,
              displayName: c.displayName,
              contactPhone: c.contactPhone,
              status
            },
            update: {}
          })
        )
    );

    const updated = await prisma.hook.findUnique({ where: { id }, include: hookInclude });
    return res.json({ message: 'Participants invited', hook: updated ? shapeHook(updated, userId) : null });
  } catch (error) {
    console.error('Error inviting participants:', error);
    return res.status(500).json({ error: 'Failed to invite participants' });
  }
};

/** Invited participant accepts or declines a shared hook. */
export const respondToHookInvite: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { status } = req.body ?? {};

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: "status must be 'accepted' or 'declined'" });
    }

    const participant = await prisma.hookParticipant.findUnique({
      where: { hookId_userId: { hookId: id, userId } }
    });
    if (!participant) {
      return res.status(404).json({ error: 'You have not been invited to this hook' });
    }

    await prisma.hookParticipant.update({
      where: { hookId_userId: { hookId: id, userId } },
      data: { status }
    });

    const updated = await prisma.hook.findUnique({ where: { id }, include: hookInclude });
    return res.json({ message: `Invitation ${status}`, hook: updated ? shapeHook(updated, userId) : null });
  } catch (error) {
    console.error('Error responding to hook invite:', error);
    return res.status(500).json({ error: 'Failed to respond to invitation' });
  }
};

/** Remove a participant from a hook (owner only). */
export const removeParticipant: CustomRequestHandler = async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id, participantId } = req.params;

    const hook = await prisma.hook.findFirst({ where: { id, ownerId: userId } });
    if (!hook) {
      return res.status(404).json({ error: 'Hook not found or you do not have permission to edit it' });
    }

    await prisma.hookParticipant.deleteMany({ where: { id: participantId, hookId: id } });
    return res.json({ message: 'Participant removed' });
  } catch (error) {
    console.error('Error removing participant:', error);
    return res.status(500).json({ error: 'Failed to remove participant' });
  }
};

/**
 * View another user's OPEN hooks (for the booking flow / contact profile).
 * Returns active open hooks plus shared/private hooks where the viewer is a participant; respects blocking.
 */
export const getUserOpenHooks: CustomRequestHandler = async (req, res) => {
  try {
    const viewerId = req.user!.id;
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, accountType: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const blocked = await prisma.blockedContact.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: viewerId },
          { blockerId: viewerId, blockedId: userId }
        ]
      }
    });
    if (blocked) {
      return res.status(403).json({ error: "You do not have permission to view this user's hooks" });
    }

    // General discovery ("open" hooks) respects the owner's profile visibility. Hooks
    // already shared directly with this viewer (below) are an explicit invite and stay
    // visible regardless — that's a separate, narrower grant.
    const canDiscover = viewerId === userId || await userService.isProfileVisibleTo(viewerId, userId);

    const [openHooks, sharedHooks] = await Promise.all([
      canDiscover
        ? prisma.hook.findMany({
            where: { ownerId: userId, accessLevel: 'open', state: 'active' },
            include: hookInclude,
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
      // Shared/private hooks owned by the target user where the viewer is a participant
      prisma.hook.findMany({
        where: {
          ownerId: userId,
          accessLevel: { in: ['shared', 'private'] },
          state: 'active',
          participants: { some: { userId: viewerId, status: { in: ['accepted', 'invited'] } } },
        },
        include: hookInclude,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const seen = new Set<string>();
    const hooks = [...openHooks, ...sharedHooks].filter((h) => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });

    return res.json({
      userId: user.id,
      name: user.name,
      hooks: hooks.map((h) => shapeHook(h, viewerId)),
    });
  } catch (error) {
    console.error('Error getting user open hooks:', error);
    return res.status(500).json({ error: 'Failed to get user hooks' });
  }
};

/**
 * List all hooks published to Mesh (business discovery feed).
 * Returns active hooks with publishedToMesh=true, supports ?search= and ?locationType=.
 */
export const getMeshHooks: CustomRequestHandler = async (req, res) => {
  try {
    const viewerId = req.user!.id;
    const { search, locationType } = req.query as Record<string, string | undefined>;

    const where: Prisma.HookWhereInput = {
      publishedToMesh: true,
      state: 'active',
    };

    if (locationType && LOCATION_TYPES.includes(locationType as typeof LOCATION_TYPES[number])) {
      where.locationType = locationType as 'remote' | 'in_person';
    }

    if (search?.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
        { owner: { name: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }

    const hooks = await prisma.hook.findMany({
      where,
      include: hookInclude,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return res.json({ hooks: hooks.map((h) => shapeHook(h, viewerId)) });
  } catch (error) {
    console.error('Error fetching mesh hooks:', error);
    return res.status(500).json({ error: 'Failed to fetch mesh hooks' });
  }
};
