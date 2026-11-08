// Azure MVP: one always-on App Service, Postgres Flexible Server, Basic Redis, and a public blob container.
// Build and push the image first, then:
//   az group create --name autopost-rg --location westeurope
//   az deployment group create --resource-group autopost-rg --template-file infra/main.bicep --parameters infra/main.parameters.example.json
// Use a URL-safe Postgres password. The 0.0.0.0 firewall rule allows Azure services, including App Service.

@description('Globally unique prefix, lowercase letters and numbers.')
param appName string = 'autopost'

param location string = resourceGroup().location

@description('Full container image, for example myregistry.azurecr.io/autopost:latest')
param imageName string

@minLength(3)
@maxLength(24)
param storageAccountName string

@secure()
param postgresPassword string

@secure()
param appEncryptionKey string

@secure()
param adminApiKey string

@secure()
param whatsappAppSecret string

@secure()
param whatsappVerifyToken string

@secure()
param whatsappToken string

param whatsappPhoneNumberId string

param allowlistPhones string = ''

@secure()
param anthropicApiKey string

param canvaClientId string = ''

@secure()
param canvaClientSecret string

param canvaRedirectUri string = ''

var postgresHost = '${appName}-pg'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource images 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'post-images'
  properties: {
    publicAccess: 'Blob'
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresHost
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: 'autopost'
    administratorLoginPassword: postgresPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: 'autopost'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource azureAccess 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'allow-azure-services'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource redis 'Microsoft.Cache/redis@2024-03-01' = {
  name: '${appName}-redis'
  location: location
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
  }
}

var redisKeys = redis.listKeys()
var storageKeys = storage.listKeys()

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'DOCKER|${imageName}'
      alwaysOn: true
      appSettings: [
        { name: 'WEBSITES_PORT', value: '3000' }
        { name: 'PORT', value: '3000' }
        { name: 'DATABASE_URL', value: 'postgresql://autopost:${postgresPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/autopost?sslmode=require' }
        { name: 'REDIS_URL', value: 'rediss://:${redisKeys.primaryKey}@${redis.properties.hostName}:6380' }
        { name: 'AZURE_STORAGE_CONNECTION_STRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storageKeys.keys[0].value};EndpointSuffix=${environment().suffixes.storage}' }
        { name: 'AZURE_BLOB_CONTAINER', value: 'post-images' }
        { name: 'PUBLIC_BASE_URL', value: 'https://${appName}.azurewebsites.net' }
        { name: 'APP_ENCRYPTION_KEY', value: appEncryptionKey }
        { name: 'ADMIN_API_KEY', value: adminApiKey }
        { name: 'WHATSAPP_APP_SECRET', value: whatsappAppSecret }
        { name: 'WHATSAPP_VERIFY_TOKEN', value: whatsappVerifyToken }
        { name: 'WHATSAPP_TOKEN', value: whatsappToken }
        { name: 'WHATSAPP_PHONE_NUMBER_ID', value: whatsappPhoneNumberId }
        { name: 'ALLOWLIST_PHONES', value: allowlistPhones }
        { name: 'ANTHROPIC_API_KEY', value: anthropicApiKey }
        { name: 'CANVA_CLIENT_ID', value: canvaClientId }
        { name: 'CANVA_CLIENT_SECRET', value: canvaClientSecret }
        { name: 'CANVA_REDIRECT_URI', value: canvaRedirectUri }
      ]
    }
  }
  dependsOn: [
    database
    azureAccess
    images
  ]
}

output hostname string = app.properties.defaultHostName
