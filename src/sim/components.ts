import { defineComponent, Types } from 'bitecs';

// Composant pour l'entité du projet en cours
export const Project = defineComponent({
  id: Types.ui32, // index dans une lookup table si besoin
  budget: Types.ui32,
  progressFrontend: Types.f32,
  progressBackend: Types.f32,
  progressDesign: Types.f32,
  
  totalFrontend: Types.f32,
  totalBackend: Types.f32,
  totalDesign: Types.f32,
  
  deadlineDay: Types.ui32,
  isCompleted: Types.ui8, // boolean
});

// Composant pour les employés (le joueur au début)
export const Employee = defineComponent({
  frontendSkill: Types.f32,
  backendSkill: Types.f32,
  designSkill: Types.f32,
  energy: Types.f32, // de 0 à 100
  isWorking: Types.ui8, // boolean
});
