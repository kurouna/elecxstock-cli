# README 用のスクリーンショット（docs/screenshots/*.png）を、Windows Terminal で実際に動かして撮る（npm run shots）。
# データは必ず架空: elecxstock のデモと同じく、スタブのプロバイダで作った .fixture/data（npm run fixture）を --data で渡し、
# 時刻を ELECXSTOCK_NOW（テストの基準日時）に固定する。アプリの実際のデータ（%APPDATA%\elecxstock）は読まない。
# 撮っている間は窓にキーを送るので、キーボードとマウスに触らないこと。
param(
  [int]$Cols = 120,
  [int]$Rows = 36,
  # 撮る場面だけ（例: -Only detail,grid）
  [string[]]$Only = @()
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'dist\elecxstock-cli.exe'
$data = Join-Path $root '.fixture\data'
$outDir = Join-Path $root 'docs\screenshots'
if (-not (Test-Path $exe)) { throw '先に npm run sea で dist\elecxstock-cli.exe を作ってください' }
if (-not (Test-Path (Join-Path $data 'market.db'))) { throw '先に npm run fixture で架空のデータ（.fixture\data）を作ってください' }
New-Item -ItemType Directory -Force $outDir | Out-Null

Add-Type -AssemblyName System.Drawing, System.Windows.Forms
Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public static class Win {
  [StructLayout(LayoutKind.Sequential)] public struct R { public int L, T, Ri, B; }
  public delegate bool P(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(P f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out R r, int n);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  public static IntPtr Find(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      var c = new StringBuilder(256); GetClassName(h, c, 256);
      var t = new StringBuilder(256); GetWindowText(h, t, 256);
      if (IsWindowVisible(h) && c.ToString() == "CASCADIA_HOSTING_WINDOW_CLASS" && t.ToString().Contains(title)) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@

[Win]::SetProcessDPIAware() | Out-Null
function Shot([string]$name, [int]$tab, [string[]]$keys) {
  if ($Only.Count -and $name -notin $Only) { return }
  $title = "elecxstock-cli-shot-$name"
  # wt は ; を自分のコマンドの区切りに使うので \; にする
  # 呼んだ側の環境に NO_COLOR があっても色を付けて撮る
  $cmd = "Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue\; `$env:ELECXSTOCK_NOW='2026-11-13T18:00:00+09:00'\; & '$exe' --data '$data' --tab $tab"
  Start-Process wt.exe -ArgumentList @('--window', 'new', '--size', "$Cols,$Rows", '--title', $title, '--suppressApplicationTitle', 'powershell.exe', '-NoProfile', '-NoLogo', '-Command', $cmd)
  $h = [IntPtr]::Zero
  for ($i = 0; $i -lt 50 -and $h -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 200; $h = [Win]::Find($title) }
  if ($h -eq [IntPtr]::Zero) { throw "窓が見つかりません: $title" }
  Start-Sleep -Seconds 5 # 窓が開ききるのと、起動と最初の描画
  foreach ($k in $keys) {
    [Win]::SetForegroundWindow($h) | Out-Null
    [System.Windows.Forms.SendKeys]::SendWait($k)
    Start-Sleep -Milliseconds 400
  }
  Start-Sleep -Milliseconds 800
  # Windows Terminal の中身は PrintWindow では写らないので、前面に出して画面から切り取る（影を除いた窓の枠: DWMWA_EXTENDED_FRAME_BOUNDS）
  [Win]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Milliseconds 300
  $r = New-Object Win+R
  [Win]::DwmGetWindowAttribute($h, 9, [ref]$r, 16) | Out-Null
  $bmp = New-Object System.Drawing.Bitmap ($r.Ri - $r.L), ($r.B - $r.T)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
  $file = Join-Path $outDir "$name.png"
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  # q で終わると、タブ（と窓）が閉じる
  [Win]::SetForegroundWindow($h) | Out-Null
  [System.Windows.Forms.SendKeys]::SendWait('q')
  Start-Sleep -Seconds 1
  Write-Output $file
}

Shot 'watchlist' 3 @()
Shot 'detail' 3 @('{DOWN}', '{DOWN}', '{DOWN}', '{ENTER}')
Shot 'grid' 3 @('v')
Shot 'holdings' 4 @()
Shot 'portfolio' 5 @()
Shot 'market' 1 @()
