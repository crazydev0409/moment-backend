# Moment App - Contact Integration API

## Overview

The Moment API follows a similar approach to WhatsApp for contact management. Instead of allowing users to manually add or edit contacts in the app, the system relies on the phone's native address book. Contacts are imported directly from the device and managed by the phone's contact system.

This contact system integrates seamlessly with the calendar-centric model, where contacts can be granted different access levels to view your calendars and request moments.

## API Endpoints

### Get User Contacts

```
GET /api/contacts
```

**Response:**
```json
{
  "contacts": [
    {
      "id": "contact-id-1",
      "ownerId": "12345678-1234-1234-1234-123456789012",
      "contactUserId": "user-id-1",
      "contactPhone": "+12345678901",
      "displayName": "John Doe",
      "phoneBookId": "phone-contact-id-1",
      "createdAt": "2023-05-29T12:00:00Z",
      "importedAt": "2023-05-29T12:00:00Z",
      "updatedAt": "2023-05-29T12:00:00Z",
      "contactUser": {
        "id": "user-id-1",
        "name": "John Doe",
        "avatar": "https://example.com/avatar.jpg"
      }
    }
  ]
}
```

### Import Contacts

```
POST /api/contacts/import
```

**Request Body:**
```json
{
  "contacts": [
    {
      "phoneNumber": "+12345678901",
      "displayName": "John Doe",
      "phoneBookId": "phone-contact-id-1"
    },
    {
      "phoneNumber": "+19876543210",
      "displayName": "Jane Smith",
      "phoneBookId": "phone-contact-id-2"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Contacts imported successfully",
  "imported": 1,
  "updated": 1,
  "failed": 0
}
```

### Sync Contacts with Registered Users

```
POST /api/contacts/sync
```

**Response:**
```json
{
  "message": "Contacts synced successfully",
  "updatedCount": 2
}
```

## Calendar Access Integration

### How Contacts Relate to Calendar Sharing

Once contacts are imported and synced, they become eligible for calendar sharing:

1. **Default Access**: New contacts get the calendar's `defaultAccessLevel` (usually "busy_time")
2. **Custom Access**: You can grant specific contacts different access levels
3. **Moment Requests**: Only contacts can send you moment requests
4. **Visibility Control**: Contacts respect your calendar's visibility settings

### Access Levels for Contacts

- **No Access**: Contact cannot see your calendar at all
- **Busy Time Only**: Contact can see when you're busy but not event details
- **View Details & Book**: Contact can see full event details and request bookings

### Contact-Based Privacy

- Only imported contacts can view your calendars
- Strangers (non-contacts) have no calendar access
- Blocked contacts lose all calendar access immediately
- Contact relationships are bidirectional for moment requests

## Implementation Guide for Mobile Apps

### Android Implementation

```kotlin
// Example using Kotlin with Retrofit
fun importContacts(context: Context) {
    val contactList = mutableListOf<ContactImport>()
    
    // Query the device contacts
    val cursor = context.contentResolver.query(
        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
        arrayOf(
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID
        ),
        null,
        null,
        null
    )
    
    cursor?.use {
        while (it.moveToNext()) {
            val phoneNo = it.getString(it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER))
            val name = it.getString(it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME))
            val contactId = it.getString(it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID))
            
            // Normalize phone number to E.164 format
            val normalizedPhone = normalizePhoneNumber(phoneNo)
            
            contactList.add(ContactImport(
                phoneNumber = normalizedPhone,
                displayName = name,
                phoneBookId = contactId
            ))
        }
    }
    
    // Send to API
    apiService.importContacts(ContactImportRequest(contactList))
        .enqueue(object : Callback<ImportResponse> {
            override fun onResponse(call: Call<ImportResponse>, response: Response<ImportResponse>) {
                // Handle successful import
                val result = response.body()
                Log.d("Contacts", "Imported: ${result?.imported}, Updated: ${result?.updated}")
                
                // Optionally sync to link with registered users
                syncContactsWithUsers()
            }
            
            override fun onFailure(call: Call<ImportResponse>, t: Throwable) {
                // Handle error
                Log.e("Contacts", "Import failed", t)
            }
        })
}

fun normalizePhoneNumber(phoneNumber: String): String {
    // Remove all non-digit characters
    val digitsOnly = phoneNumber.replace(Regex("[^\\d]"), "")
    
    // Add country code if missing (assuming US +1 for this example)
    return when {
        digitsOnly.startsWith("1") && digitsOnly.length == 11 -> "+$digitsOnly"
        digitsOnly.length == 10 -> "+1$digitsOnly"
        else -> "+$digitsOnly"
    }
}
```

### iOS Implementation

```swift
// Example using Swift with URLSession
import Contacts

func importContacts() {
    let store = CNContactStore()
    
    store.requestAccess(for: .contacts) { granted, error in
        guard granted else {
            // Handle permission denied
            print("Contact access denied")
            return
        }
        
        let keys = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactPhoneNumbersKey, CNContactIdentifierKey]
        let request = CNContactFetchRequest(keysToFetch: keys as [CNKeyDescriptor])
        var contactsToImport: [[String: Any]] = []
        
        do {
            try store.enumerateContacts(with: request) { contact, stop in
                for phoneNumber in contact.phoneNumbers {
                    let number = phoneNumber.value.stringValue
                    let normalizedNumber = normalizePhoneNumber(number)
                    
                    contactsToImport.append([
                        "phoneNumber": normalizedNumber,
                        "displayName": "\(contact.givenName) \(contact.familyName)".trimmingCharacters(in: .whitespacesAndNewlines),
                        "phoneBookId": contact.identifier
                    ])
                }
            }
            
            // Send to API
            sendContactsToAPI(contactsToImport)
            
        } catch {
            print("Error fetching contacts: \(error)")
        }
    }
}

func normalizePhoneNumber(_ phoneNumber: String) -> String {
    // Remove all non-digit characters
    let digitsOnly = phoneNumber.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
    
    // Add country code if missing (assuming US +1 for this example)
    if digitsOnly.hasPrefix("1") && digitsOnly.count == 11 {
        return "+\(digitsOnly)"
    } else if digitsOnly.count == 10 {
        return "+1\(digitsOnly)"
    } else {
        return "+\(digitsOnly)"
    }
}

func sendContactsToAPI(_ contacts: [[String: Any]]) {
    let requestBody: [String: Any] = ["contacts": contacts]
    
    guard let jsonData = try? JSONSerialization.data(withJSONObject: requestBody),
          let url = URL(string: "https://api.momentapp.com/api/contacts/import") else {
        return
    }
    
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.httpBody = jsonData
    request.addValue("application/json", forHTTPHeaderField: "Content-Type")
    request.addValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
    
    URLSession.shared.dataTask(with: request) { data, response, error in
        if let error = error {
            print("Import failed: \(error)")
            return
        }
        
        if let data = data,
           let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            print("Import successful: \(result)")
            
            // Sync contacts to link with registered users
            syncContactsWithUsers()
        }
    }.resume()
}
```

## Calendar Access Management

### Setting Contact Permissions

After importing contacts, you can manage their calendar access:

```javascript
// Example: Grant a contact "view_book" access to your calendar
async function grantCalendarAccess(contactUserId, accessLevel) {
    const response = await fetch('/api/users/sharing', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userId: contactUserId,
            permission: accessLevel // 'view' or 'edit' (maps to access levels)
        })
    });
    
    return response.json();
}

// Example: Block a contact (removes all calendar access)
async function blockContact(contactUserId) {
    const response = await fetch('/api/users/block', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userId: contactUserId
        })
    });
    
    return response.json();
}
```

## Best Practices

1. **Request Permission First**: Always request and verify contact permissions before attempting to access the phone's address book.

2. **Phone Number Normalization**: Convert all phone numbers to E.164 format (+1234567890) for consistent matching across platforms.

3. **Background Sync**: Implement periodic background syncs to keep contact relationships updated when users join or leave the platform.

4. **Bandwidth Optimization**: For large contact lists, consider implementing batched imports or delta updates instead of sending the entire contact list each time.

5. **Privacy Compliance**: Only send the minimum required contact information to the server. Consider user consent for contact sharing.

6. **Error Handling**: Implement robust error handling for failed imports, network issues, and permission denials.

7. **User Experience**: Provide clear feedback about import progress and sync status.

8. **Calendar Integration**: After contact import, guide users through setting up calendar sharing preferences for their most important contacts.

## Security Considerations

### Data Protection
- Contact data is encrypted in transit and at rest
- Phone numbers are stored in normalized format for consistent matching
- Contact import respects user privacy settings

### Access Control
- Only the contact owner can see their imported contacts
- Contact relationships are used to enforce calendar access permissions
- Blocked users lose all access to contact's calendars immediately

### Privacy Features
- Users control which contacts can see their calendars
- Default access levels protect privacy while enabling functionality
- Granular permissions allow fine-tuned sharing control

## Integration with Calendar Features

### Moment Requests
- Only contacts can send moment requests
- Contact relationships enable request validation
- Blocked contacts cannot send requests

### Calendar Sharing
- Contact import enables calendar access control
- Default access levels apply to all imported contacts
- Individual contacts can be granted special permissions

### Real-time Updates
- Contact status changes trigger real-time notifications
- Calendar access updates are immediate
- WebSocket connections notify of contact-related events

This contact system provides the foundation for secure, privacy-focused calendar sharing in the Moment app. 