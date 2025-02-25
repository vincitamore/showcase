#!/usr/bin/env pwsh
<#
.SYNOPSIS
Manages Twitter API rate limits

.DESCRIPTION
This script allows checking and resetting Twitter API rate limits

.PARAMETER Action
The action to perform: 'check' or 'reset'. Defaults to 'check'.

.PARAMETER Endpoint
Optional endpoint to check or reset. If not specified, manages all endpoints.

.PARAMETER DevSecret
The development secret for authentication. Defaults to DEV_SECRET environment variable.

.PARAMETER BaseUrl
Base URL of the application. Defaults to NEXT_PUBLIC_URL environment variable or http://localhost:3000

.EXAMPLE
.\reset-rate-limits.ps1
Checks the status of all rate limits

.EXAMPLE
.\reset-rate-limits.ps1 -Action reset
Resets all expired rate limits

.EXAMPLE
.\reset-rate-limits.ps1 -Endpoint "tweets/search/recent"
Checks status for the specified endpoint only
#>

param(
    [ValidateSet('check', 'reset')]
    [string]$Action = 'check',
    
    [string]$Endpoint = "",
    
    [string]$DevSecret = $env:DEV_SECRET,
    
    [string]$BaseUrl = $env:NEXT_PUBLIC_URL
)

# Set defaults if not provided
if (-not $BaseUrl) {
    $BaseUrl = "http://localhost:3000"
}

if (-not $DevSecret) {
    $DevSecret = $env:CRON_SECRET
    if (-not $DevSecret) {
        Write-Error "Error: DEV_SECRET or CRON_SECRET environment variable is required"
        exit 1
    }
}

# Build the URL
$Url = "${BaseUrl}/api/dev/reset-rate-limits?action=${Action}"
if ($Endpoint) {
    $Url += "&endpoint=${Endpoint}"
}

Write-Host "Performing $Action for rate limits..." -ForegroundColor Cyan
if ($Endpoint) {
    Write-Host "Endpoint: $Endpoint" -ForegroundColor Cyan
}
Write-Host "URL: $Url"

try {
    $Response = Invoke-RestMethod -Uri $Url -Headers @{
        "Authorization" = "Bearer $DevSecret"
        "Content-Type" = "application/json"
    } -Method Get -ErrorAction Stop

    if ($Action -eq 'check') {
        Write-Host "`nRate Limits Status:" -ForegroundColor Green
        
        if ($Endpoint) {
            # Single endpoint display
            $data = @{
                Endpoint = $Response.endpoint
                "Reset At" = $Response.resetAt
                Remaining = $Response.remaining
                Expired = $Response.isExpired
                "Time Until Reset" = $Response.timeUntilReset
            }
            
            [PSCustomObject]$data | Format-List
        } else {
            # Multiple endpoints display
            $Response.rateLimits | ForEach-Object {
                $expired = $_.isExpired
                $color = if ($expired -eq $true) { "Red" } else { "Green" }
                
                Write-Host "`nEndpoint: " -NoNewline
                Write-Host $_.endpoint -ForegroundColor Cyan
                
                Write-Host "Status: " -NoNewline
                Write-Host $(if ($expired) { "EXPIRED" } else { "ACTIVE" }) -ForegroundColor $color
                
                Write-Host "Reset At: $($_.resetAt)"
                Write-Host "Remaining: $($_.remaining)"
                Write-Host "Time Until Reset: $($_.timeUntilReset)" 
            }
        }
    } else {
        # Reset action
        Write-Host "`nRate Limits Reset:" -ForegroundColor Green
        Write-Host "Checked: $($Response.result.checked) rate limits"
        Write-Host "Reset: $($Response.result.reset) expired limits"
    }
} catch {
    Write-Host "Error performing rate limit operation:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorContent = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorContent | ConvertTo-Json -Depth 5
        } catch {
            Write-Host $_.ErrorDetails.Message
        }
    }
    
    exit 1
} 