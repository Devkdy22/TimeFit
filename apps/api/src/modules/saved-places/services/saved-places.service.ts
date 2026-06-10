import { Injectable } from '@nestjs/common';
import { CreateSavedPlaceDto } from '../dto/create-saved-place.dto';
import { normalizeSavedPlaceLabel } from '../saved-place-label.normalizer';
import type { SavedPlaceEntity } from '../types/saved-place.types';
import { SavedPlacesRepository } from './saved-places.repository';

@Injectable()
export class SavedPlacesService {
  constructor(private readonly repository: SavedPlacesRepository) {}

  list(userId: string): Promise<SavedPlaceEntity[]> {
    return this.repository.findByUser(userId);
  }

  create(userId: string, dto: CreateSavedPlaceDto): Promise<SavedPlaceEntity> {
    const normalized = normalizeSavedPlaceLabel(dto.label);
    return this.repository.createOrUpdateByLabel({
      userId,
      label: normalized.canonicalLabel,
      normalizedLabel: normalized.normalizedLabel,
      address: dto.address.trim(),
      lat: dto.lat,
      lng: dto.lng,
    });
  }

  delete(userId: string, id: string): Promise<void> {
    return this.repository.deleteOwned(userId, id);
  }
}
