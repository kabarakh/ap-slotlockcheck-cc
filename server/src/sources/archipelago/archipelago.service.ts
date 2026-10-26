import { Injectable } from '@nestjs/common';

import { SourceHttpService } from '../http/source-http.service.js';
import {
  datapackageSchema,
  roomStatusSchema,
  slotDataTrackerSchema,
  staticTrackerSchema,
  trackerDataSchema,
  type Datapackage,
  type RoomStatus,
  type SlotDataTracker,
  type StaticTracker,
  type TrackerData,
} from './archipelago.schemas.js';

@Injectable()
export class ArchipelagoService {
  constructor(private readonly http: SourceHttpService) {}

  getRoomStatus(origin: string, roomId: string): Promise<RoomStatus> {
    return this.http.getJson(this.apiUrl(origin, 'room_status', roomId), roomStatusSchema);
  }

  getTracker(origin: string, trackerId: string): Promise<TrackerData> {
    return this.http.getJson(this.apiUrl(origin, 'tracker', trackerId), trackerDataSchema);
  }

  getStaticTracker(origin: string, trackerId: string): Promise<StaticTracker> {
    return this.http.getJson(this.apiUrl(origin, 'static_tracker', trackerId), staticTrackerSchema);
  }

  getSlotData(origin: string, trackerId: string): Promise<SlotDataTracker> {
    return this.http.getJson(this.apiUrl(origin, 'slot_data_tracker', trackerId), slotDataTrackerSchema);
  }

  wakeRoom(origin: string, roomId: string): Promise<void> {
    return this.http.visit(new URL(`/room/${encodeURIComponent(roomId)}`, origin).toString());
  }

  getDatapackage(origin: string, checksum: string): Promise<Datapackage> {
    return this.http.getJson(this.apiUrl(origin, 'datapackage', checksum), datapackageSchema);
  }

  private apiUrl(origin: string, endpoint: string, id: string): string {
    return new URL(`/api/${endpoint}/${encodeURIComponent(id)}`, origin).toString();
  }
}
