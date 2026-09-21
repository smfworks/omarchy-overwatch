import { colorForKind } from '../globe/colors'

export const LAYER_LEGEND = [
  { id: 'quake', label: 'USGS earthquake', color: colorForKind('quake') },
  { id: 'event', label: 'EONET / event', color: colorForKind('event') },
  { id: 'aircraft', label: 'ADS-B aircraft', color: colorForKind('aircraft') },
  { id: 'vessel', label: 'AIS vessel', color: colorForKind('vessel') },
  { id: 'alert', label: 'NWS alert', color: colorForKind('alert') },
  { id: 'fire', label: 'FIRMS / fire', color: colorForKind('fire') },
  { id: 'sat', label: 'SAT (CelesTrak)', color: colorForKind('sat') },
  { id: 'hazard', label: 'GDACS / NHC / NIFC', color: colorForKind('hazard') },
  { id: 'heat2', label: 'HEAT L=2', color: 'rgba(62, 224, 200, 0.45)' },
  { id: 'heat3', label: 'HEAT L=3', color: 'rgba(232, 184, 74, 0.5)' },
  { id: 'heat4', label: 'HEAT L=4+', color: 'rgba(255, 93, 108, 0.55)' },
] as const
