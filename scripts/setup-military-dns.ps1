# ==============================================================================
# scripts/setup-military-dns.ps1
# Tu dong dong bo Zone DNS Noi bo Tu Chu (Air-Gapped Authoritative DNS)
# Ho tro:
#   1. Cap nhat file Zone chuan RFC 1035 cho CoreDNS (config/military-infra/dns/tqs.com.zone)
#   2. Neu may chu dang chay Windows Server DNS Role (AD Integrated), tu dong tao Zone
#      va cap nhat ban ghi A cho trungtamdulieuso.tqs.com toi IP moi (1.000.000+ thiet bi!)
# ==============================================================================
param(
    [Parameter(Mandatory = $true)]
    [string]$ServerIP,
    [string]$Hostname = "trungtamdulieuso.tqsqk7.edu",
    [switch]$UpdateWindowsDnsServer
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir
$ZoneFile  = Join-Path $RootDir "config\military-infra\dns\tqsqk7.edu.zone"

# Tach ten may chu (host) va ten mien goc (zone), vd: trungtamdulieuso + tqs.com
$parts = $Hostname.Split(".")
if ($parts.Count -lt 2) {
    Write-Error "Hostname '$Hostname' khong hop le (can dang host.domain.tld, vd: trungtamdulieuso.tqs.com)"
    exit 1
}
$recordName = $parts[0]
$zoneName   = ($parts[1..($parts.Count - 1)] -join ".")

# 1. Cap nhat file RFC 1035 Zone cho CoreDNS / BIND9
if (Test-Path $ZoneFile) {
    $serial = (Get-Date -Format "yyyyMMdd") + (Get-Date -Format "HH")
    $zoneContent = @"
; ==============================================================================
; RFC 1035 Authoritative DNS Zone  $zoneName (QK7 DataHub Air-Gapped Military LAN)
; Cap nhat tu dong boi: scripts\setup-military-dns.ps1 | scripts\doi-ip.bat
; Khi doi IP may chu tren quy mo 1.000.000 thiet bi: CHI dOI IP TAI dAY!
; ==============================================================================
`$ORIGIN $zoneName.
`$TTL 30

@               IN SOA  dns1.$zoneName. admin.$zoneName. (
                        $serial ; Serial (YYYYMMDDHH)
                        60         ; Refresh (Slave DNS dong bo moi 60s)
                        15         ; Retry
                        604800     ; Expire (7 ngay neu mat ket noi lien tinh)
                        30 )       ; Minimum Negative TTL

; May chu DNS Tham quyen (Master / Slave Anycast)
@               IN NS   dns1.$zoneName.
@               IN NS   dns2.$zoneName.

dns1            IN A    $ServerIP
dns2            IN A    $ServerIP

; Cong Trung Tam Du Lieu So QK7 DataHub (https://$Hostname)
$recordName IN A        $ServerIP
api             IN CNAME $Hostname.
ca              IN A    $ServerIP
soc             IN CNAME $Hostname.
"@
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ZoneFile, $zoneContent, $utf8NoBom)
    Write-Host "[DNS]  da cap nhat CoreDNS/BIND9 Zone ($ZoneFile): $Hostname -> $ServerIP" -ForegroundColor Green
}

# 2. Cap nhat truc tiep Windows Server DNS (neu may chu cai san DNS Server Role)
$dnsCmd = Get-Command Get-DnsServerZone -ErrorAction SilentlyContinue
if ($dnsCmd -and ($UpdateWindowsDnsServer -or (Get-Service -Name DNS -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' }))) {
    try {
        $existingZone = Get-DnsServerZone -Name $zoneName -ErrorAction SilentlyContinue
        if (-not $existingZone) {
            Write-Host "[DNS] Tao moi Primary Zone '$zoneName' tren Windows DNS Server..." -ForegroundColor Yellow
            Add-DnsServerPrimaryZone -Name $zoneName -ZoneFile "$zoneName.dns" -ErrorAction Stop
        }
        $oldRecs = Get-DnsServerResourceRecord -ZoneName $zoneName -Name $recordName -RRType A -ErrorAction SilentlyContinue
        foreach ($r in $oldRecs) {
            Remove-DnsServerResourceRecord -ZoneName $zoneName -InputObject $r -Force -ErrorAction SilentlyContinue
        }
        Add-DnsServerResourceRecordA -ZoneName $zoneName -Name $recordName -IPv4Address $ServerIP -TimeToLive ([TimeSpan]::FromSeconds(30))
        Write-Host "[DNS]  da cap nhat truc tiep Windows Server DNS: $Hostname -> $ServerIP (TTL 30s)" -ForegroundColor Green
    } catch {
        Write-Warning "[DNS] Khong the ghi vao Windows Server DNS cuc bo: $($_.Exception.Message)"
    }
} else {
    Write-Host "[DNS]   Tren May chu DNS Quan Doi (Active Directory DNS), chay dung 1 dong lenh sau de 1.000.000+ thiet bi tu dong tro sang $ServerIP`:" -ForegroundColor Cyan
    Write-Host "      dnscmd /RecordDelete $zoneName $recordName A /f && dnscmd /RecordAdd $zoneName $recordName 30 A $ServerIP" -ForegroundColor Yellow
}
