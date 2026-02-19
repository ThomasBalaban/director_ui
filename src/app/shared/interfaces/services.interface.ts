import { ServiceStatus } from '../../shared/interfaces/director.interfaces';

export interface ServiceDetail extends ServiceStatus {
  description: string;
  pid: number | null;
  health_check: string;
  cwd?: string;
  logs?: string[];
  logsOpen?: boolean;
  actionPending?: boolean;
}

export interface AudioDevice {
  id: number;
  name: string;
  channels: number;
  default_samplerate: number;
  is_active: boolean;
}

export const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  online:    { label: 'Online',    color: '#22c55e', icon: '●' },
  offline:   { label: 'Offline',   color: '#4b5563', icon: '○' },
  starting:  { label: 'Starting',  color: '#3b82f6', icon: '◌' },
  stopping:  { label: 'Stopping',  color: '#f59e0b', icon: '◌' },
  unhealthy: { label: 'Unhealthy', color: '#ef4444', icon: '⚠' },
  unknown:   { label: 'Unknown',   color: '#6b7280', icon: '?' },
};

export const GUI_SERVICES = new Set(['desktop_monitor']);

export const VSCODE_LOGO_SVG = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width:13px;height:13px;fill:currentColor;flex-shrink:0">
    <path d="M74.5 7.27L51.5 27.79 32.17 11.5 25 15.08v69.84l7.17 3.58L51.5 72.21 74.5 92.73 90 85.5V14.5L74.5 7.27zM74.5 74.08L54.07 50 74.5 25.92V74.08z"/>
  </svg>
`;