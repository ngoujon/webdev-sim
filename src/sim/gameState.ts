// Données métier accessibles globalement (pour UI et rendu sans passer par les composants)
export const GameState = {
  money: 500,
  reputation: 0,
  day: 1,
  timeOfDay: 9, // 9:00 AM
  
  // Office stats
  officeLevel: 1, // 1 = Garage, 2 = Agence, 3 = Grand Open Space
  deskCount: 1,   // Nombre de bureaux total
  purchasedPoles: [] as string[], // ex: 'finance', 'datacenter', 'recherche', 'universite'
  employeesCount: 1, // Le joueur au début
  
  officeDirt: 0, // Niveau de saleté (0 à 100)
  fridgeDirt: 0, // Saleté spécifique autour du frigo (0 à 100)
  hasDoubleScreens: false,
  hasTrashCans: false,
  hasPremiumCoffee: false,
  hasAssistant: false,
  hasOperationsDirector: false,
  hasSalesDirector: false,
  hasReadBookToday: false,
  hasCleaner: false,
  
  get openSpaceBlocks(): number {
    return 1 + this.purchasedPoles.length;
  },
  
  // Player Position (pour la petite chambre)
  playerPos: { x: 150, y: 150 },
  playerDir: 'down' as 'up' | 'down' | 'left' | 'right',
  isMoving: false,
  keys: { z: false, q: false, s: false, d: false },
  
  // Level System
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  
  // Progression des compétences du joueur (Frontend/Backend/Design)
  // Les valeurs de compétence elles-mêmes vivent dans le composant ECS Employee (playerEid),
  // ceci ne suit que l'XP accumulée par compétence pour déclencher les montées de niveau.
  playerSkillXp: {
    frontend: 0,
    backend: 0,
    design: 0
  },
  playerSkillXpToNextLevel: {
    frontend: 50,
    backend: 50,
    design: 50
  },
  
  // Active projects info dictionary since ECS doesn't store strings easily
  projectInfos: new Map<number, { title: string, budget: number, deadlineDay: number }>(),
  
  availableContracts: [] as Array<any>,

  availableCandidates: [] as Array<{
    id: string;
    type: 'junior' | 'senior' | 'designer' | 'pm' | 'hr' | 'sales' | 'professeur' | 'cleaner';
    name: string;
    title: string;
    baseCost: number;
    salary: number;
    level: number;
    description: string;
  }>,

  generateCandidates() {
    this.availableCandidates = [];
    const types = ['junior', 'senior', 'designer'];
    if (this.officeLevel >= 2) types.push('pm');
    if (this.officeLevel >= 3) types.push('hr', 'sales');
    if (this.purchasedPoles.includes('universite')) types.push('professeur');

    const firstNames = ["Lucas", "Emma", "Thomas", "Chloé", "Hugo", "Léa", "Maxime", "Manon", "Antoine", "Camille"];
    const lastNames = ["Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois", "Moreau", "Laurent"];
    
    let hasProf = false;
    for (const info of this.employeesInfo.values()) {
      if (info.role === 'prof') hasProf = true;
    }
    
    const count = 3 + Math.floor(Math.random() * 4); // 3 to 6 candidates
    for (let i = 0; i < count; i++) {
      let type = types[Math.floor(Math.random() * types.length)];
      
      // La présence d'un professeur peut forcer la génération de candidats étudiants gratuits
      let isStudent = false;
      if (hasProf && Math.random() < 0.3) { // 30% de chance d'être un étudiant gratuit
        isStudent = true;
        // L'étudiant peut être n'importe quel rôle (sauf professeur)
        const studentTypes = ['junior', 'senior', 'designer', 'pm', 'hr', 'sales'];
        type = studentTypes[Math.floor(Math.random() * studentTypes.length)];
      }
      
      const name = firstNames[Math.floor(Math.random() * firstNames.length)] + " " + lastNames[Math.floor(Math.random() * lastNames.length)];
      
      let title = "";
      let baseCost = 0;
      let salary = 0;
      let level = 1;
      let description = "";

      if (type === 'junior') { title = "Développeur Junior"; baseCost = 500; salary = 250; level = 1; description = "Niveau Frontend/Backend: 1"; }
      else if (type === 'senior') { title = "Développeur Senior"; baseCost = 1500; salary = 800; level = 3; description = "Niveau Frontend/Backend: 3"; }
      else if (type === 'designer') { title = "Designer"; baseCost = 800; salary = 400; level = 3; description = "Niveau Design: 3"; }
      else if (type === 'pm') { title = "Chef de Projet"; baseCost = 1000; salary = 400; level = 1; description = "Effet: +5 limite de projets"; }
      else if (type === 'hr') { title = "Responsable RH"; baseCost = 1000; salary = 500; level = 1; description = "Effet: -50% frais de recrutement"; }
      else if (type === 'sales') { title = "Commercial (Sales)"; baseCost = 1200; salary = 600; level = 1; description = "Effet: +30% budget contrats"; }
      else if (type === 'professeur') { title = "Professeur"; baseCost = 2500; salary = 1000; level = 1; description = "Forme des étudiants (recrutement $0)"; }
      else if (type === 'cleaner') { title = "Agent d'entretien"; baseCost = 400; salary = 200; level = 1; description = "Nettoie les locaux la nuit"; }

      if (isStudent) {
        title += " (Étudiant)";
        baseCost = 0; // Cost is 0
        description = "Formé par l'université. Coût de recrutement nul.";
      }

      this.availableCandidates.push({
        id: Math.random().toString(36).substr(2, 9),
        type: type as any,
        name,
        title,
        baseCost,
        salary,
        level,
        description
      });
    }
  },

  // For UI rendering
  activeProjects: [] as Array<{
    eid: number,
    title: string,
    budget: number,
    deadlineDay: number,
    progress: { fe: number, totalFe: number, be: number, totalBe: number, des: number, totalDes: number }
  }>,

  // Employees extra info for AI and rendering
  employeesInfo: new Map<number, {
    x: number,
    y: number,
    dir: 'up' | 'down' | 'left' | 'right',
    state: 'working' | 'moving_to_desk' | 'moving_to_food' | 'moving_to_toilet' | 'eating' | 'toilet' | 'leaving' | 'off_duty' | 'moving_to_babyfoot' | 'playing_babyfoot',
    targetX: number,
    targetY: number,
    deskIndex: number,
    actionTimer: number,
    hunger: number,
    thirst: number,
    bladder: number,
    isMoving: boolean,
    title: string,
    role: 'dev' | 'designer' | 'hr' | 'sales' | 'pm' | 'prof' | 'cleaner',
    salary: number,
    level: number,
    xp: number,
    xpToNextLevel: number,
    salesTimer?: number,
    employedSinceDay: number,
    retireAtDay: number,
    visuals: {
      skinColor: string,
      shirtColor: string,
      pantsColor: string,
      hairColor: string,
      shoesColor: string
    }
  }>(),
  
  playerEid: 0, // Stocker l'ID ECS du joueur
  
  // Player needs (100 = full/satisfied, 0 = empty/danger)
  // Sauf Vessie (bladder) : 0 = vide (bien), 100 = pleine (danger/envie pressante)
  needs: {
    energy: 100,
    hunger: 100,
    thirst: 100,
    bladder: 0
  },
  
  isToiletOccupied: false,
  
  get concentration(): number {
    const n = this.needs;
    // Inversion pour la vessie car 100 est mauvais
    const bladderScore = 100 - n.bladder; 
    
    const avg = (n.energy + n.hunger + n.thirst + bladderScore) / 4;
    // Si un besoin est critique (proche de 0 pour faim/soif/fatigue, ou proche de 100 pour vessie)
    const minNeed = Math.min(n.energy, n.hunger, n.thirst, bladderScore);
    
    if (minNeed < 10) return minNeed; // Grosse pénalité si on meurt de faim/soif/envie
    return avg;
  },

  get projectLimit(): number {
    let limit = 5;
    if (this.hasOperationsDirector) limit += 10;
    for (const info of this.employeesInfo.values()) {
      if (info.role === 'pm') limit += 5;
    }
    return limit;
  },

  actionKey: false,
  actionKeyPrevious: false,
  isPaused: true, // Le jeu commence en pause pour le Menu Principal
  isPlayerAtDesk: false,
  
  nearInteractable: null as 'bed' | 'food' | 'toilet' | 'assistant' | 'ops_director' | 'sales_director' | 'tennis' | 'bookcase' | 'babyfoot' | 'cleaning_station' | null,
  
  openedWindows: [] as Array<{id: string, x: number, y: number}>,
  
  // Action states
  playerActionState: 'idle' as 'idle' | 'sleeping' | 'eating' | 'toilet' | 'playing_tennis' | 'reading' | 'playing_babyfoot',
  actionTimer: 0,
  
  transactions: [] as Array<{ day: number, amount: number, type: 'income' | 'expense', description: string }>,
  
  completedProjects: [] as Array<{
    title: string;
    budget: number;
    nextPatchDay: number;
  }>,

  addMoney(amount: number, description?: string) {
    this.money += amount;
    if (description) {
      this.transactions.push({
        day: this.day,
        amount: Math.abs(amount),
        type: amount > 0 ? 'income' : 'expense',
        description
      });
    }
    // Play SFX
    if (amount > 0) {
      import('../audio/AudioEngine').then(m => m.audioEngine.playIncomeSound());
    } else if (amount < 0) {
      import('../audio/AudioEngine').then(m => m.audioEngine.playExpenseSound());
    }
    
    // Emit event pour l'UI
    import('../core/EventBus').then(m => m.EventBus.emit('MONEY_CHANGED', this.money));
  },
  
  addXp(amount: number) {
    this.xp += amount;
    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level += 1;
      this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
      import('../core/EventBus').then(m => m.EventBus.emit('LEVEL_UP', this.level));
    }
    import('../core/EventBus').then(m => m.EventBus.emit('XP_CHANGED', this.xp));
  }
};
