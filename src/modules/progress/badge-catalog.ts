import { BadgeTier } from '../users/dto/badge-tier.enum';

export interface BadgeMetadata {
  tier: BadgeTier;
  title: string;
  description: string;
  iconKey: string;
  color: string;
  threshold: number;
}

export const BADGE_CATALOG: BadgeMetadata[] = [
  {
    tier: BadgeTier.Iron,
    title: 'Mentor Iron',
    description: 'Debloque apres 5 parrainages ou sessions validees.',
    iconKey: 'badge-iron',
    color: '#94A3B8',
    threshold: 5,
  },
  {
    tier: BadgeTier.Bronze,
    title: 'Mentor Bronze',
    description: 'Debloque apres 10 parrainages ou sessions validees.',
    iconKey: 'badge-bronze',
    color: '#EA580C',
    threshold: 10,
  },
  {
    tier: BadgeTier.Silver,
    title: 'Mentor Silver',
    description: 'Debloque apres 15 parrainages ou sessions validees.',
    iconKey: 'badge-silver',
    color: '#E5E7EB',
    threshold: 15,
  },
  {
    tier: BadgeTier.Gold,
    title: 'Mentor Gold',
    description: 'Debloque apres 20 parrainages ou sessions validees.',
    iconKey: 'badge-gold',
    color: '#EAB308',
    threshold: 20,
  },
];
