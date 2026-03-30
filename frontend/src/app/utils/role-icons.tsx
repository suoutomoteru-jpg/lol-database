import { Wand2, Shield, Swords, UserRound, Heart, Target, type LucideIcon } from 'lucide-react';
import type { Role, ItemType } from '../data/mock-data';

export const roleIcons: Record<Role, LucideIcon> = {
  Mage:     Wand2,
  Tank:     Shield,
  Assassin: Swords,
  Fighter:  UserRound,
  Support:  Heart,
  Marksman: Target,
};

export const itemTypeIcons: Record<ItemType, LucideIcon> = {
  Fighter:  UserRound,
  Marksman: Target,
  Assassin: Swords,
  Magic:    Wand2,
  Defense:  Shield,
  Support:  Heart,
};
