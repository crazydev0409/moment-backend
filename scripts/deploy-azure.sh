#!/bin/bash
set -e

# ==============================================================================
# Azure Deployment Script for moment-backend
# Deploys: App Service (Docker) + PostgreSQL Flexible Server + Redis Cache
# ==============================================================================

# --- Configuration (edit these) -----------------------------------------------
RESOURCE_GROUP="moment-backend-rg"
LOCATION="eastus"
APP_NAME="moment-backend"
ACR_NAME="momentbackendacr"          # Must be globally unique, alphanumeric only
POSTGRES_SERVER="moment-db-server"
POSTGRES_DB="moment_prod"
POSTGRES_ADMIN="momentadmin"
POSTGRES_PASSWORD=""                  # Set below or via prompt
REDIS_NAME="moment-redis-cache"
APP_SERVICE_PLAN="moment-backend-plan"
SKU_PLAN="B1"                         # B1=Basic, S1=Standard, P1v3=Premium
SKU_POSTGRES="B_Standard_B1ms"        # Burstable 1 vCore
SKU_REDIS="C0"                        # Basic C0 (250MB)
# ------------------------------------------------------------------------------

echo "========================================"
echo "  Azure Deployment: moment-backend"
echo "========================================"

# Check Azure CLI is installed and logged in
if ! command -v az &> /dev/null; then
  echo "Error: Azure CLI (az) is not installed."
  echo "Install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
  exit 1
fi

if ! az account show &> /dev/null 2>&1; then
  echo "Not logged in to Azure. Running 'az login'..."
  az login
fi

echo ""
echo "Active subscription:"
az account show --query "{Name:name, ID:id}" -o table
echo ""
read -p "Continue with this subscription? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
  echo "Run 'az account set --subscription <id>' to switch, then re-run."
  exit 1
fi

# Prompt for PostgreSQL password if not set
if [ -z "$POSTGRES_PASSWORD" ]; then
  echo ""
  read -sp "Enter a password for PostgreSQL admin ($POSTGRES_ADMIN): " POSTGRES_PASSWORD
  echo ""
  if [ ${#POSTGRES_PASSWORD} -lt 8 ]; then
    echo "Error: Password must be at least 8 characters."
    exit 1
  fi
fi

# ==============================================================================
# Step 1: Resource Group
# ==============================================================================
echo ""
echo "[1/6] Creating resource group '$RESOURCE_GROUP' in '$LOCATION'..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" -o none

# ==============================================================================
# Step 2: Azure Container Registry
# ==============================================================================
echo "[2/6] Creating Azure Container Registry '$ACR_NAME'..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  -o none

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
echo "  ACR: $ACR_LOGIN_SERVER"

# Build locally and push Docker image
echo "  Logging in to ACR..."
az acr login --name "$ACR_NAME"

echo "  Building Docker image locally..."
docker build -t "${ACR_LOGIN_SERVER}/moment-backend:latest" -f Dockerfile .

echo "  Pushing Docker image to ACR..."
docker push "${ACR_LOGIN_SERVER}/moment-backend:latest"

# ==============================================================================
# Step 3: Azure Database for PostgreSQL (Flexible Server)
# ==============================================================================
echo "[3/6] Creating PostgreSQL Flexible Server '$POSTGRES_SERVER'..."
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --location "$LOCATION" \
  --admin-user "$POSTGRES_ADMIN" \
  --admin-password "$POSTGRES_PASSWORD" \
  --sku-name "$SKU_POSTGRES" \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --yes \
  -o none

# Create the database
echo "  Creating database '$POSTGRES_DB'..."
az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$POSTGRES_SERVER" \
  --database-name "$POSTGRES_DB" \
  -o none

# Allow Azure services to connect
echo "  Configuring firewall (allow Azure services)..."
az postgres flexible-server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --rule-name "AllowAzureServices" \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  -o none

POSTGRES_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --query fullyQualifiedDomainName -o tsv)

DATABASE_URL="postgresql://${POSTGRES_ADMIN}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?sslmode=require"
echo "  PostgreSQL: $POSTGRES_HOST"

# ==============================================================================
# Step 4: Azure Cache for Redis
# ==============================================================================
echo "[4/6] Creating Azure Cache for Redis '$REDIS_NAME'..."
echo "  (This can take 10-20 minutes...)"
az redis create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$REDIS_NAME" \
  --location "$LOCATION" \
  --sku Basic \
  --vm-size "$SKU_REDIS" \
  --redis-version 6 \
  -o none

REDIS_HOST=$(az redis show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$REDIS_NAME" \
  --query hostName -o tsv)

REDIS_KEY=$(az redis list-keys \
  --resource-group "$RESOURCE_GROUP" \
  --name "$REDIS_NAME" \
  --query primaryKey -o tsv)

REDIS_URL="rediss://:${REDIS_KEY}@${REDIS_HOST}:6380/0"
echo "  Redis: $REDIS_HOST"

# ==============================================================================
# Step 5: App Service Plan + Web App
# ==============================================================================
echo "[5/6] Creating App Service Plan and Web App..."
az appservice plan create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_PLAN" \
  --sku "$SKU_PLAN" \
  --is-linux \
  -o none

ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

az webapp create \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_SERVICE_PLAN" \
  --name "$APP_NAME" \
  --docker-registry-server-url "https://${ACR_LOGIN_SERVER}" \
  --docker-registry-server-user "$ACR_NAME" \
  --docker-registry-server-password "$ACR_PASSWORD" \
  --container-image-name "${ACR_LOGIN_SERVER}/moment-backend:latest" \
  -o none

# ==============================================================================
# Step 6: Configure Environment Variables
# ==============================================================================
echo "[6/6] Configuring app settings..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --settings \
    NODE_ENV=production \
    PORT=3000 \
    WEBSITES_PORT=3000 \
    DATABASE_URL="$DATABASE_URL" \
    REDIS_URL="$REDIS_URL" \
    EVENT_BUS_ADAPTER=memory \
  -o none

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "  App URL:      https://${APP_NAME}.azurewebsites.net"
echo "  ACR:          $ACR_LOGIN_SERVER"
echo "  PostgreSQL:   $POSTGRES_HOST"
echo "  Redis:        $REDIS_HOST"
echo ""
echo "  IMPORTANT: Set your secrets manually:"
echo ""
echo "  az webapp config appsettings set \\"
echo "    --resource-group $RESOURCE_GROUP \\"
echo "    --name $APP_NAME \\"
echo "    --settings \\"
echo "      JWT_SECRET=\"<your-secret-min-32-chars>\" \\"
echo "      JWT_REFRESH_SECRET=\"<your-secret-min-32-chars>\" \\"
echo "      CALENDAR_ENCRYPTION_SECRET=\"<your-secret-min-32-chars>\" \\"
echo "      TWILIO_ACCOUNT_SID=\"<your-sid>\" \\"
echo "      TWILIO_AUTH_TOKEN=\"<your-token>\" \\"
echo "      TWILIO_PHONE_NUMBER=\"<your-number>\" \\"
echo "      TWILIO_VERIFY_SERVICE_SID=\"<your-sid>\" \\"
echo "      GOOGLE_OAUTH_CLIENT_ID=\"<your-id>\" \\"
echo "      GOOGLE_OAUTH_CLIENT_SECRET=\"<your-secret>\" \\"
echo "      MICROSOFT_OAUTH_CLIENT_ID=\"<your-id>\" \\"
echo "      MICROSOFT_OAUTH_CLIENT_SECRET=\"<your-secret>\" \\"
echo "      MICROSOFT_OAUTH_TENANT_ID=\"<your-tenant>\""
echo ""
echo "  To redeploy after code changes:"
echo "    cd moment-backend"
echo "    az acr login --name $ACR_NAME"
echo "    docker build -t ${ACR_LOGIN_SERVER}/moment-backend:latest -f Dockerfile ."
echo "    docker push ${ACR_LOGIN_SERVER}/moment-backend:latest"
echo "    az webapp restart --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo ""
echo "  To view logs:"
echo "    az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo ""
echo "  To tear down everything:"
echo "    az group delete --name $RESOURCE_GROUP --yes --no-wait"
echo ""
