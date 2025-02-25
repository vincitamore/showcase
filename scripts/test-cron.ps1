#!/usr/bin/env pwsh
<#
.SYNOPSIS
Tests a cron job endpoint directly

.DESCRIPTION
This script allows testing cron job endpoints without waiting for scheduled execution

.PARAMETER Path
The cron job path to test, defaults to /api/cron/fetch-tweets

.PARAMETER DevSecret
The development secret for authentication, defaults to the DEV_SECRET environment variable

.PARAMETER BaseUrl
Base URL of the application, defaults to NEXT_PUBLIC_URL environment variable or http://localhost:3000

.EXAMPLE
.\test-cron.ps1
Tests the default fetch-tweets cron job

.EXAMPLE
.\test-cron.ps1 -Path "/api/cron/rotate-logs" -DevSecret "mysecret123"
Tests the rotate-logs cron job with a specific secret
#>

param(
    [string]$Path = "/api/cron/fetch-tweets",
    [string]$DevSecret = $env:DEV_SECRET,
    [string]$BaseUrl = $env:NEXT_PUBLIC_URL
)

# Set defaults if not provided
if (-not $BaseUrl) {
    $BaseUrl = "https://amore.build"
}

if (-not $DevSecret) {
    $DevSecret = $env:CRON_SECRET
    if (-not $DevSecret) {
        Write-Error "Error: DEV_SECRET or CRON_SECRET environment variable is required"
        exit 1
    }
}

# Method 1: Test using the dev test endpoint
$DevTestUrl = "${BaseUrl}/api/dev/test-cron?path=${Path}"
Write-Host "Testing via development endpoint: $DevTestUrl"

try {
    $DevResponse = Invoke-RestMethod -Uri $DevTestUrl -Headers @{
        "Authorization" = "Bearer $DevSecret"
        "Content-Type" = "application/json"
    } -Method Get -ErrorAction Stop

    Write-Host "Development endpoint test successful:" -ForegroundColor Green
    $DevResponse | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Development endpoint test failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host "Status code: $($_.Exception.Response.StatusCode.value__)"
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorContent = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorContent | ConvertTo-Json -Depth 5
        } catch {
            Write-Host $_.ErrorDetails.Message
        }
    }
}

Write-Host "`n----------------------------------------`n"

# Method 2: Test the endpoint directly with the dev_key parameter
$DirectTestUrl = "${BaseUrl}${Path}?dev_key=${DevSecret}&test=true"
Write-Host "Testing by calling endpoint directly: $DirectTestUrl"

try {
    $DirectResponse = Invoke-RestMethod -Uri $DirectTestUrl -Method Get -ErrorAction Stop

    Write-Host "Direct endpoint test successful:" -ForegroundColor Green
    $DirectResponse | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Direct endpoint test failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host "Status code: $($_.Exception.Response.StatusCode.value__)"
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorContent = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorContent | ConvertTo-Json -Depth 5
        } catch {
            Write-Host $_.ErrorDetails.Message
        }
    }
} 