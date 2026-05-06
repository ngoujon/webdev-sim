import { GameLoop } from './core/GameLoop';
import { EventBus } from './core/EventBus';
import { world } from './sim/world';
import { GameState } from './sim/gameState';
import { createTimeSystem, createWorkSystem, createNeedsSystem, createEmployeeSystem } from './sim/systems';
import { DesktopUI } from './ui/Desktop';
import { Renderer } from './render/Renderer';
import { audioEngine } from './audio/AudioEngine';
import { SaveManager } from './save/SaveManager';
import { getRandomContracts } from './data/contracts';
import { addEntity, addComponent, removeEntity } from 'bitecs';
import { Project, Employee } from './sim/components';

// --- Initialization ---
const ui = new DesktopUI();
const renderer = new Renderer('world-canvas');

// ECS Systems
const timeSystem = createTimeSystem();
const workSystem = createWorkSystem();
const needsSystem = createNeedsSystem();
const employeeSystem = createEmployeeSystem();

// Initialisation du joueur (1er employé)
const playerEid = addEntity(world);
GameState.playerEid = playerEid;
addComponent(world, Employee, playerEid);
Employee.frontendSkill[playerEid] = 1;
Employee.backendSkill[playerEid] = 1;
Employee.designSkill[playerEid] = 1;
Employee.energy[playerEid] = 100;
Employee.isWorking[playerEid] = 1;

// --- Event Handling ---

const getBudgetMultiplier = () => {
  let multiplier = 1;
  for (const info of GameState.employeesInfo.values()) {
    if (info.role === 'sales') multiplier += 0.3;
  }
  return multiplier;
};

const autoAcceptContracts = () => {
  if (!GameState.hasSalesDirector) return;
  let accepted = false;
  while (GameState.activeProjects.length < GameState.projectLimit && GameState.availableContracts.length > 0) {
    const contract = GameState.availableContracts.shift();
    if (contract) {
      const pEid = addEntity(world);
      addComponent(world, Project, pEid);
      Project.budget[pEid] = contract.budget;
      Project.difficulty[pEid] = contract.difficulty;
      Project.requiredFe[pEid] = contract.requiredTasks.frontend;
      Project.requiredBe[pEid] = contract.requiredTasks.backend;
      Project.requiredDes[pEid] = contract.requiredTasks.design;
      Project.progressFe[pEid] = 0;
      Project.progressBe[pEid] = 0;
      Project.progressDes[pEid] = 0;
      Project.isCompleted[pEid] = 0;
      
      const deadlineDay = GameState.day + (contract.deadlineDays || 5);

      GameState.activeProjects.push(pEid);
      GameState.projectInfos.set(pEid, { title: contract.title, budget: contract.budget, deadlineDay });
      accepted = true;
    }
  }
  if (accepted && ui.isContractsWindowOpen()) {
    ui.renderContracts(GameState.availableContracts);
  }
  if (accepted) {
    ui.updateProjectProgressWindow();
  }
};

EventBus.on('REQUEST_CONTRACTS', () => {
  if (GameState.availableContracts.length === 0) {
    GameState.availableContracts = getRandomContracts(3, getBudgetMultiplier());
  }
  if (GameState.hasSalesDirector) {
    autoAcceptContracts();
  }
  if (ui.isContractsWindowOpen()) {
    ui.renderContracts(GameState.availableContracts);
  }
});

EventBus.on('SALES_GENERATED_CONTRACT', () => {
  if (GameState.availableContracts.length >= 15) return; // Limite de contrats sur le tableau

  const isPremium = Math.random() < 0.20; // 20% de chance d'avoir un "sur mesure"
  const template = { ...getRandomContracts(1, 1)[0] }; // Récupère un contrat de base
  
  if (isPremium) {
     template.title = "✨ Sur Mesure: " + template.title;
     template.budget = Math.floor(template.budget * 3 * getBudgetMultiplier()); 
     template.difficulty += 1;
     template.requiredTasks.frontend *= 2;
     template.requiredTasks.backend *= 2;
     template.requiredTasks.design *= 2;
     template.deadlineDays = template.deadlineDays ? template.deadlineDays + 2 : 7; // More time for premium
  } else {
     template.budget = Math.floor(template.budget * getBudgetMultiplier());
  }
  
  // ID is already unique from getRandomContracts
  
  GameState.availableContracts.push(template);
  
  if (GameState.hasSalesDirector) {
    autoAcceptContracts();
  }
  
  if (ui.isContractsWindowOpen()) {
     ui.renderContracts(GameState.availableContracts);
  }
  
  ui.showToast(`Un commercial a décroché un contrat ${isPremium ? 'SUR MESURE !' : 'standard.'}`, isPremium ? 'success' : 'info');
  if (isPremium) audioEngine.playSuccessSound();
});

// Pour que la fonction soit appelable depuis le HTML (onclick="window.acceptContract(...)")
(window as any).acceptContract = (id: string) => {
  const limit = GameState.projectLimit;
  if (GameState.projectInfos.size >= limit) {
    ui.showDialog("Attention", `Vous avez déjà trop de projets en cours (limite: ${limit}) ! Engagez un Chef de Projet pour augmenter cette limite.`);
    return;
  }
  
  const idx = GameState.availableContracts.findIndex((c: any) => c.id === id);
  if (idx === -1) return;
  const template = GameState.availableContracts[idx];

  // Création de l'entité Projet
  const projectEid = addEntity(world);
  addComponent(world, Project, projectEid);
  Project.id[projectEid] = projectEid;
  Project.budget[projectEid] = template.budget;
  
  Project.totalFrontend[projectEid] = template.requiredTasks.frontend;
  Project.totalBackend[projectEid] = template.requiredTasks.backend;
  Project.totalDesign[projectEid] = template.requiredTasks.design;
  
  Project.progressFrontend[projectEid] = 0;
  Project.progressBackend[projectEid] = 0;
  Project.progressDesign[projectEid] = 0;
  Project.isCompleted[projectEid] = 0;

  const daysToComplete = template.deadlineDays || (3 + Math.floor(Math.random() * 5));
  GameState.projectInfos.set(projectEid, {
    title: template.title,
    budget: template.budget,
    deadlineDay: GameState.day + daysToComplete
  });

  // Remove the accepted contract and generate a new one
  GameState.availableContracts.splice(idx, 1);
  const newContract = { ...getRandomContracts(1, getBudgetMultiplier())[0] };
  GameState.availableContracts.push(newContract);
  
  if (ui.isContractsWindowOpen()) {
    ui.renderContracts(GameState.availableContracts);
  }

  audioEngine.playClickSound();
  ui.updateStatsOverlay(); // Met à jour les stats (argent, etc)
  ui.openProjectProgressWindow(true); // Ouvre la barre de progression ou met à jour
};

(window as any).upgradeOffice = () => {
  if (GameState.money >= 2000 && GameState.officeLevel === 1) {
    GameState.addMoney(-2000, "Déménagement (Agence)");
    GameState.officeLevel = 2;
    audioEngine.playSuccessSound();
    ui.showDialog("Déménagement", "Vous avez déménagé dans de nouveaux locaux !");
    ui.renderRealEstate();
    EventBus.emit('MONEY_CHANGED', GameState.money);
    
    // Forcer les employés à retourner à leur bureau pour s'adapter au nouveau layout
    GameState.employeesInfo.forEach(info => {
      info.state = 'moving_to_desk';
      info.isMoving = true;
    });
    
    const recruitBtn = document.getElementById('btn-recruit');
    if (recruitBtn) recruitBtn.style.display = 'block';
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $2000 pour déménager.");
  }
};

(window as any).upgradeToOpenSpace = () => {
  if (GameState.money >= 5000 && GameState.officeLevel === 2) {
    GameState.addMoney(-5000, "Agrandissement (Grand Open Space)");
    GameState.officeLevel = 3;
    audioEngine.playSuccessSound();
    ui.showDialog("Agrandissement", "Vous avez débloqué le Grand Open Space et de nouveaux profils (RH, Commerciaux) !");
    ui.renderRealEstate();
    EventBus.emit('MONEY_CHANGED', GameState.money);

    // Forcer les employés à retourner à leur bureau pour s'adapter au nouveau layout
    GameState.employeesInfo.forEach(info => {
      info.state = 'moving_to_desk';
      info.isMoving = true;
    });
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $5000 pour agrandir l'agence.");
  }
};

(window as any).buyDesk = () => {
  const maxDesks = GameState.officeLevel >= 3 ? (1 + GameState.openSpaceBlocks * 6) : (GameState.officeLevel === 2 ? 6 : 1);
  if (GameState.deskCount >= maxDesks) {
    ui.showDialog("Erreur", "Vous n'avez plus de place pour de nouveaux bureaux. Agrandissez d'abord !");
    return;
  }
  
  if (GameState.money >= 1000) {
    GameState.addMoney(-1000, "Achat d'un Bureau");
    GameState.deskCount++;
    audioEngine.playSuccessSound();
    ui.showDialog("Nouvel aménagement", "Vous avez ajouté un nouveau bureau !");
    ui.renderRealEstate();
    EventBus.emit('MONEY_CHANGED', GameState.money);
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $1000 pour ajouter un bureau.");
  }
};

(window as any).buyPole = (poleId: string) => {
  const polesInfo: Record<string, {name: string, cost: number}> = {
    'finance': { name: 'Pôle Finance', cost: 10000 },
    'datacenter': { name: 'Datacenter', cost: 15000 },
    'recherche': { name: 'Pôle Recherche', cost: 20000 },
    'universite': { name: 'Université', cost: 30000 }
  };
  
  const pole = polesInfo[poleId];
  if (!pole) return;

  if (GameState.purchasedPoles.includes(poleId)) {
    ui.showDialog("Erreur", "Vous possédez déjà ce pôle.");
    return;
  }

  if (GameState.money >= pole.cost) {
    GameState.addMoney(-pole.cost, `Achat Pôle : ${pole.name}`);
    GameState.purchasedPoles.push(poleId);
    audioEngine.playSuccessSound();
    ui.showDialog("Agrandissement", `Vous avez ouvert le ${pole.name} ! Cela ajoute un nouveau bloc à l'Open Space.`);
    ui.renderRealEstate();
    EventBus.emit('MONEY_CHANGED', GameState.money);
  } else {
    ui.showDialog("Fonds insuffisants", `Il vous faut $${pole.cost} pour ouvrir ce pôle.`);
  }
};

(window as any).openAssignDesksWindow = () => {
  ui.openAssignDesksWindow();
};

(window as any).assignEmployeeToBlock = (eid: number, blockStr: string) => {
  const block = parseInt(blockStr);
  const info = GameState.employeesInfo.get(eid);
  if (!info) return;

  // Find a free desk in the target block
  const desksInBlock = [];
  for (let i = 1; i <= 9; i++) desksInBlock.push((block - 1) * 9 + i);
  
  const occupiedDesks = new Set<number>();
  for (const emp of GameState.employeesInfo.values()) occupiedDesks.add(emp.deskIndex);
  
  let newDesk = -1;
  for (const d of desksInBlock) {
    if (d < GameState.deskCount && !occupiedDesks.has(d)) {
      newDesk = d;
      break;
    }
  }
  
  if (newDesk !== -1) {
    info.deskIndex = newDesk;
    info.state = 'moving_to_desk'; // Force them to move
    audioEngine.playClickSound();
    ui.renderAssignDesks();
  } else {
    ui.showDialog("Erreur", "Ce bloc est plein ou vous n'avez pas acheté assez de bureaux dans ce bloc !");
  }
};

(window as any).recruitEmployee = (id: string, costOverride?: number) => {
  const candidateIndex = GameState.availableCandidates.findIndex(c => c.id === id);
  if (candidateIndex === -1) {
    ui.showDialog("Erreur", "Ce candidat n'est plus disponible.");
    return;
  }
  const candidate = GameState.availableCandidates[candidateIndex];

  if (GameState.employeesCount >= GameState.deskCount) {
    ui.showDialog("Erreur", "Pas de bureau disponible pour ce nouvel employé !");
    return;
  }
  
  let cost = costOverride !== undefined ? costOverride : candidate.baseCost;
  
  let fe = 1, be = 1, des = 1;
  let role: 'dev' | 'designer' | 'hr' | 'sales' | 'pm' | 'prof' | 'cleaner' = candidate.type === 'junior' || candidate.type === 'senior' ? 'dev' : (candidate.type === 'professeur' ? 'prof' : candidate.type as any);
  
  if (candidate.type === 'junior' || candidate.type === 'senior') { fe = candidate.level; be = candidate.level; }
  else if (candidate.type === 'designer') { fe = 1; be = 1; des = candidate.level; }
  else { fe = 0; be = 0; des = 0; }

  if (GameState.money >= cost) {
    GameState.availableCandidates.splice(candidateIndex, 1);
    GameState.addMoney(-cost, "Frais de recrutement : " + candidate.name);
    GameState.employeesCount++;
    
    // Ajout dans l'ECS
    const empEid = addEntity(world);
    addComponent(world, Employee, empEid);
    Employee.frontendSkill[empEid] = fe;
    Employee.backendSkill[empEid] = be;
    Employee.designSkill[empEid] = des;
    Employee.energy[empEid] = 100;
    Employee.isWorking[empEid] = 1;
    
    const w = window.innerWidth / 4;
    const h = window.innerHeight / 4;
    
    const skinColors = ['#f1c40f', '#f39c12', '#e67e22', '#d35400', '#f5b041', '#e59866', '#d68910', '#873600'];
    const shirtColors = ['#3498db', '#2ecc71', '#9b59b6', '#1abc9c', '#f1c40f', '#e67e22', '#ecf0f1', '#34495e', '#95a5a6'];
    const pantsColors = ['#2980b9', '#34495e', '#7f8c8d', '#2c3e50', '#8e44ad', '#16a085'];
    const hairColors = ['#3e2723', '#111', '#e67e22', '#f1c40f', '#95a5a6', '#7f8c8d', '#c0392b', '#8B4513'];
    const shoesColors = ['#333', '#111', '#7f8c8d', '#8B4513', '#ecf0f1'];
    
    const randomPick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    
    let assignedDesk = 1;
    const occupiedDesks = new Set<number>();
    for (const info of GameState.employeesInfo.values()) occupiedDesks.add(info.deskIndex);
    for (let i = 1; i < GameState.deskCount; i++) {
      if (!occupiedDesks.has(i)) { assignedDesk = i; break; }
    }

    GameState.employeesInfo.set(empEid, {
      x: w / 2, y: h + 20, // Apparaît en bas (porte)
      dir: 'up',
      state: 'moving_to_desk',
      targetX: 0, targetY: 0, // Sera défini par l'IA
      deskIndex: assignedDesk, // Le bureau attribué intelligemment
      actionTimer: 0,
      hunger: 100,
      thirst: 100,
      bladder: 0,
      isMoving: true,
      title: candidate.name + " (" + candidate.title + ")",
      role: role,
      salary: candidate.salary,
      level: candidate.level,
      xp: 0,
      xpToNextLevel: 100,
      employedSinceDay: GameState.day,
      retireAtDay: GameState.day + 60 + Math.floor(Math.random() * 40), // Retire after 60-100 days
      visuals: {
        skinColor: randomPick(skinColors),
        shirtColor: randomPick(shirtColors),
        pantsColor: randomPick(pantsColors),
        hairColor: randomPick(hairColors),
        shoesColor: randomPick(shoesColors)
      }
    });
    
    audioEngine.playSuccessSound();
    ui.showDialog("Recrutement", `${candidate.name} a rejoint votre équipe !`);
    ui.renderRecruit(); // Rafraîchir la fenêtre
    EventBus.emit('MONEY_CHANGED', GameState.money);
  } else {
    ui.showDialog("Fonds insuffisants", `Il vous faut $${cost} pour recruter ce candidat.`);
  }
};

(window as any).fireEmployee = (eid: number) => {
  if (GameState.employeesInfo.has(eid)) {
    const emp = GameState.employeesInfo.get(eid);
    GameState.employeesInfo.delete(eid);
    removeEntity(world, eid);
    GameState.employeesCount--;
    audioEngine.playClickSound();
    ui.showDialog("Licenciement", `${emp?.title || 'Employé'} a quitté l'équipe.`);
    ui.renderRecruit(); // Rafraîchir la fenêtre
  }
};

EventBus.on('EMPLOYEE_RETIRED', (data) => {
  audioEngine.playClickSound();
  let msg = `${data.title} est parti(e) à la retraite bien méritée !`;
  
  let hasHR = false;
  for (const info of GameState.employeesInfo.values()) {
    if (info.role === 'hr') hasHR = true;
  }
  
  if (hasHR) {
    // HR automatically recruits a replacement
    const firstNames = ["Alex", "Sam", "Charlie", "Jordan", "Camille", "Sasha", "Robin", "Lou"];
    const lastNames = ["Dupont", "Martin", "Leroy", "Moreau", "Simon", "Laurent", "Michel", "Garcia"];
    const name = firstNames[Math.floor(Math.random() * firstNames.length)] + " " + lastNames[Math.floor(Math.random() * lastNames.length)];
    
    // Create candidate matching the retired employee's role
    const typeMap: Record<string, string> = {
      'dev': data.level >= 3 ? 'senior' : 'junior',
      'designer': 'designer',
      'hr': 'hr',
      'sales': 'sales',
      'pm': 'pm'
    };
    
    const candidateType = typeMap[data.role] || 'junior';
    let salary = 250;
    if (candidateType === 'senior') salary = 800;
    if (candidateType === 'designer') salary = 400;
    if (candidateType === 'pm') salary = 400;
    if (candidateType === 'hr') salary = 500;
    if (candidateType === 'sales') salary = 600;
    
    const candidate = {
      id: Math.random().toString(36).substr(2, 9),
      type: candidateType as any,
      name: name,
      title: "Remplaçant " + data.role,
      baseCost: 0, // Recruté par RH sans frais supplémentaire d'agence
      salary: salary,
      level: data.level > 0 ? data.level : 1,
      description: "Recruté automatiquement par les RH."
    };
    
    GameState.availableCandidates.push(candidate);
    // Auto recruit the generated candidate
    (window as any).recruitEmployee(candidate.id, 0);
    
    msg += `\n\nLes RH ont automatiquement recruté ${candidate.name} pour le remplacer.`;
  }
  
  ui.showDialog("Départ à la retraite", msg);
  ui.renderRecruit();
});

EventBus.on('PROJECT_COMPLETED', (data) => {
  ui.showTaskbarNotification(`Projet terminé - ${data.title}`);
  ui.updateProjectProgressWindow(); // Dernière mise à jour pour le vider
});

EventBus.on('PATCH_REQUIRED', (data) => {
  // Un correctif est un projet qui ne rapporte rien et bloque un profil aléatoirement
  const isFront = Math.random() < 0.33;
  const isBack = !isFront && Math.random() < 0.5;
  const isDesign = !isFront && !isBack;
  
  const projectEid = addEntity(world);
  addComponent(world, Project, projectEid);
  Project.id[projectEid] = projectEid;
  Project.budget[projectEid] = 0;
  
  Project.totalFrontend[projectEid] = isFront ? 40 : 0;
  Project.totalBackend[projectEid] = isBack ? 40 : 0;
  Project.totalDesign[projectEid] = isDesign ? 40 : 0;
  
  Project.progressFrontend[projectEid] = 0;
  Project.progressBackend[projectEid] = 0;
  Project.progressDesign[projectEid] = 0;
  Project.isCompleted[projectEid] = 0;

  GameState.projectInfos.set(projectEid, {
    title: `Correctif: ${data.title}`,
    budget: 0,
    deadlineDay: GameState.day + 2 // Seulement 2 jours pour le patch !
  });
  
  audioEngine.playClickSound(); // Jouer un son d'alerte
  ui.showToast(`Un correctif urgent est requis pour "${data.title}" !`, 'error');
  ui.openProjectProgressWindow(true);
});

EventBus.on('EMPLOYEE_LEVEL_UP', (data) => {
  audioEngine.playSuccessSound();
  ui.showToast(`${data.title} a atteint le niveau ${data.level} !`, 'info');
});

EventBus.on('PROJECT_FAILED', (data) => {
  audioEngine.playClickSound(); // Fallback son
  ui.showToast(`Deadline dépassée pour "${data.title}". Pénalité de $${data.budget / 2} !`, 'error');
  ui.updateProjectProgressWindow();
});

EventBus.on('RENT_PAID', (data) => {
  audioEngine.playClickSound();
  let msg = `Une nouvelle semaine commence ! Voici le détail de vos factures :<br/>`;
  msg += `<ul>`;
  msg += `<li>Loyer : $${data.amount}</li>`;
  if (data.salaries > 0) {
    msg += `<li>Salaires équipe : $${data.salaries}</li>`;
  }
  if (data.electricity > 0) {
    msg += `<li>Électricité : $${data.electricity}</li>`;
  }
  if (data.hosting > 0) {
    msg += `<li>Hébergement serveurs : $${data.hosting}</li>`;
  }
  msg += `</ul>`;
  
  if (data.hosting > 0 && GameState.officeLevel >= 3) {
    msg += `<p style="font-size:16px; color:#f39c12;">Astuce : Achetez le Datacenter pour héberger vous-même vos serveurs et économiser ces frais !</p>`;
  }

  ui.showDialog("Fin de semaine", msg);
});

EventBus.on('OPEN_ASSISTANT_MENU', () => {
  ui.openAssistantWindow();
});

EventBus.on('OPEN_OPS_MENU', () => {
  ui.openOpsWindow();
});

EventBus.on('OPEN_SALES_DIR_MENU', () => {
  ui.openSalesDirWindow();
});

(window as any).recruitOpsDirector = () => {
  if (GameState.money >= 10000) {
    GameState.addMoney(-10000, "Recrutement Dir. Opérations");
    GameState.hasOperationsDirector = true;
    audioEngine.playSuccessSound();
    ui.showDialog("Recrutement terminé", "Votre Directeur des Opérations vient de rejoindre l'équipe ! Il augmente drastiquement la limite de projets simultanés.");
    ui.renderOpsWindow();
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $10000 pour recruter un Directeur des Opérations.");
  }
};

(window as any).recruitSalesDirector = () => {
  if (GameState.money >= 10000) {
    GameState.addMoney(-10000, "Recrutement Dir. Commercial");
    GameState.hasSalesDirector = true;
    audioEngine.playSuccessSound();
    ui.showDialog("Recrutement terminé", "Votre Directeur Commercial vient de rejoindre l'équipe ! Il acceptera automatiquement les contrats à votre place.");
    ui.renderSalesDirWindow();
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $10000 pour recruter un Directeur Commercial.");
  }
};

(window as any).recruitAssistant = () => {
  if (GameState.money >= 2000) {
    GameState.addMoney(-2000, "Recrutement Assistant(e)");
    GameState.hasAssistant = true;
    audioEngine.playSuccessSound();
    ui.showDialog("Recrutement terminé", "Votre nouvel(le) assistant(e) de direction vient d'arriver !");
    ui.renderAssistant();
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $2000 pour recruter un(e) assistant(e).");
  }
};

(window as any).assistantTeamBuilding = () => {
  if (GameState.money >= 1500) {
    GameState.addMoney(-1500, "Repas d'équipe");
    
    // Remplir besoins du joueur
    GameState.needs.energy = 100;
    GameState.needs.hunger = 100;
    GameState.needs.thirst = 100;
    GameState.needs.bladder = 0;
    EventBus.emit('NEEDS_CHANGED');

    // Remplir besoins des employés
    for (const info of GameState.employeesInfo.values()) {
      info.hunger = 100;
      info.thirst = 100;
      info.bladder = 0;
    }
    
    audioEngine.playSuccessSound();
    ui.showDialog("Super initiative !", "Toute l'équipe a bien mangé et le moral est à 100% !");
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $1500 pour organiser un repas d'équipe.");
  }
};

(window as any).assistantCleanOffice = () => {
  if (GameState.money >= 500) {
    GameState.addMoney(-500, "Service de nettoyage");
    GameState.officeDirt = 0;
    GameState.fridgeDirt = 0;
    audioEngine.playSuccessSound();
    ui.showDialog("Nettoyage terminé", "Vos locaux sentent bon le propre !");
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $500 pour payer l'entreprise de nettoyage.");
  }
};

(window as any).assistantBuyDoubleScreens = () => {
  if (GameState.money >= 5000) {
    GameState.addMoney(-5000, "Achat de Doubles Écrans");
    GameState.hasDoubleScreens = true;
    audioEngine.playSuccessSound();
    ui.showDialog("Achat effectué", "L'équipe est maintenant équipée de doubles écrans !");
    ui.renderAssistant();
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $5000 pour équiper tout le monde.");
  }
};

(window as any).assistantBuyCoffee = () => {
  if (GameState.money >= 3000) {
    GameState.addMoney(-3000, "Achat Machine à Café Premium");
    GameState.hasPremiumCoffee = true;
    audioEngine.playSuccessSound();
    ui.showDialog("Achat effectué", "Une superbe machine à café a été installée !");
    ui.renderAssistant();
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $3000 pour cette machine.");
  }
};

(window as any).assistantBuyTrashCans = () => {
  if (GameState.money >= 1000) {
    GameState.addMoney(-1000, "Achat de poubelles");
    GameState.hasTrashCans = true;
    audioEngine.playSuccessSound();
    ui.showDialog("Achat effectué", "Des poubelles ont été installées sous chaque bureau !");
    ui.renderAssistant();
  } else {
    ui.showDialog("Fonds insuffisants", "Il vous faut $1000 pour acheter les poubelles.");
  }
};

// --- Menu Functions ---
(window as any).startScreenNew = () => {
  SaveManager.clearSave();
  document.getElementById('start-screen')!.classList.add('hidden');
  GameState.isPaused = false;
};

(window as any).startScreenDevMode = () => {
  SaveManager.clearSave();
  document.getElementById('start-screen')!.classList.add('hidden');
  GameState.isPaused = false;
  ui.openDevWindow();
};

(window as any).devAddMoney = () => {
  GameState.addMoney(500000, "Cheat Mode");
};

(window as any).devSetLevel = (lvl: number) => {
  GameState.officeLevel = lvl;
  if (lvl === 1) GameState.deskCount = 1;
  if (lvl === 2) GameState.deskCount = 6;
  if (lvl === 3) GameState.deskCount = 6;
  
  if (lvl >= 2) {
    const recruitBtn = document.getElementById('btn-recruit');
    if (recruitBtn) recruitBtn.style.display = 'block';
  }
  ui.renderRealEstate();
  ui.showToast(`Passage au niveau ${lvl}`, 'success');
};

(window as any).devUnlockPoles = () => {
  if (!GameState.purchasedPoles.includes('finance')) GameState.purchasedPoles.push('finance');
  if (!GameState.purchasedPoles.includes('datacenter')) GameState.purchasedPoles.push('datacenter');
  if (!GameState.purchasedPoles.includes('recherche')) GameState.purchasedPoles.push('recherche');
  if (!GameState.purchasedPoles.includes('universite')) GameState.purchasedPoles.push('universite');
  GameState.deskCount += 24; // 4 * 6
  ui.renderRealEstate();
  ui.showToast('Tous les pôles débloqués !', 'success');
};

(window as any).devMaxNeeds = () => {
  GameState.needs.energy = 100;
  GameState.needs.hunger = 100;
  GameState.needs.thirst = 100;
  GameState.needs.bladder = 0;
  for (const info of GameState.employeesInfo.values()) {
    info.hunger = 100;
    info.thirst = 100;
    info.bladder = 0;
  }
  import('./core/EventBus').then(m => m.EventBus.emit('NEEDS_CHANGED'));
  ui.showToast('Besoins restaurés !', 'success');
};

(window as any).startScreenLoad = () => {
  if (SaveManager.load()) {
    ui.renderRealEstate();
    const recruitBtn = document.getElementById('btn-recruit');
    if (recruitBtn) recruitBtn.style.display = GameState.officeLevel > 1 ? 'block' : 'none';
    
    // Restore windows
    if (GameState.openedWindows && GameState.openedWindows.length > 0) {
      ui.restoreWindowsState(GameState.openedWindows);
    }
    
    document.getElementById('start-screen')!.classList.add('hidden');
    GameState.isPaused = false;
  } else {
    alert("Aucune sauvegarde trouvée.");
  }
};

(window as any).quitToMenu = () => {
  location.reload();
};

(window as any).saveGame = () => {
  GameState.openedWindows = ui.getOpenWindowsState();
  SaveManager.save();
  ui.showDialog("Sauvegarde", "Partie sauvegardée avec succès !");
};

(window as any).openSettings = () => {
  ui.openSettingsWindow();
};

(window as any).openAudioSettings = () => {
  ui.openAudioWindow();
};

(window as any).updateAudio = () => {
  const master = parseFloat((document.getElementById('vol-master') as HTMLInputElement).value);
  const bgm = parseFloat((document.getElementById('vol-bgm') as HTMLInputElement).value);
  const sfx = parseFloat((document.getElementById('vol-sfx') as HTMLInputElement).value);
  audioEngine.updateVolumes(master, bgm, sfx);
};

(window as any).resumeGame = () => {
  (window as any).closeDialog('pause-menu');
  GameState.isPaused = false;
};

EventBus.on('OPEN_CLEANER_MENU', () => {
  ui.openCleanerMenu();
});

(window as any).recruitCleaner = () => {
  if (GameState.money >= 400 && !GameState.hasCleaner) {
    GameState.addMoney(-400, "Recrutement Agent d'entretien");
    GameState.hasCleaner = true;
    audioEngine.playSuccessSound();
    ui.showDialog("Recrutement réussi", "L'agent d'entretien a été engagé !");
    
    // Spawn cleaner entity
    const empEid = addEntity(world);
    addComponent(world, Employee, empEid);
    Employee.frontendSkill[empEid] = 0;
    Employee.backendSkill[empEid] = 0;
    Employee.designSkill[empEid] = 0;
    Employee.energy[empEid] = 100;
    Employee.isWorking[empEid] = 1;
    
    const w = window.innerWidth / 4;
    const h = window.innerHeight / 4;
    
    GameState.employeesInfo.set(empEid, {
      x: w / 2, y: h + 20,
      dir: 'up',
      state: 'working',
      targetX: 20, targetY: 20,
      deskIndex: -1, // No desk
      actionTimer: 0,
      hunger: 100, thirst: 100, bladder: 0,
      isMoving: false,
      title: "Agent d'entretien",
      role: 'cleaner',
      salary: 200,
      level: 1, xp: 0, xpToNextLevel: 100,
      employedSinceDay: GameState.day,
      skinColor: '#e67e22', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#111', shoesColor: '#111'
    });
    
    if (ui.wm.hasWindow('cleaner')) {
      ui.wm.closeWindow('cleaner');
    }
  } else if (GameState.money < 400) {
    ui.showDialog("Fonds insuffisants", "Il vous faut $400 pour engager l'agent d'entretien.");
  }
};

// Initialiser l'audio au premier click sur le document (policy des navigateurs)
document.addEventListener('mousedown', () => {
  audioEngine.init();
}, { once: true });

// Input Handling pour le mouvement
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ui.openPauseMenu();
    return;
  }
  
  const k = e.key.toLowerCase();
  if (k === 'z' || k === 'w') GameState.keys.z = true;
  if (k === 'q' || k === 'a') GameState.keys.q = true;
  if (k === 's') GameState.keys.s = true;
  if (k === 'd') GameState.keys.d = true;
  if (k === 'e' || k === ' ') GameState.actionKey = true;
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'z' || k === 'w') GameState.keys.z = false;
  if (k === 'q' || k === 'a') GameState.keys.q = false;
  if (k === 's') GameState.keys.s = false;
  if (k === 'd') GameState.keys.d = false;
  if (k === 'e' || k === ' ') GameState.actionKey = false;
});

// Play typing sound when working (simulated based on state)
setInterval(() => {
  if (GameState.projectInfos.size > 0 && GameState.isPlayerAtDesk) {
    audioEngine.playTypingSound();
  }
}, 500);

// --- Game Loop ---
const gameLoop = new GameLoop(
  (dt) => {
    if (GameState.isPaused) return;

    // Fixed Update
    timeSystem(world, dt);
    needsSystem(world, dt);
    employeeSystem(world, dt);
    workSystem(world, dt);

    // Player movement (Both levels)
    const speed = 0.18 * dt; // Vitesse augmentée (était 0.1)
    let dx = 0; let dy = 0;
    
    if (GameState.playerActionState === 'idle') {
      if (GameState.keys.z) { dy -= speed; GameState.playerDir = 'up'; }
      if (GameState.keys.s) { dy += speed; GameState.playerDir = 'down'; }
      if (GameState.keys.q) { dx -= speed; GameState.playerDir = 'left'; }
      if (GameState.keys.d) { dx += speed; GameState.playerDir = 'right'; }
    }
    
    GameState.isMoving = (dx !== 0 || dy !== 0);

    const w = window.innerWidth / 4;
    const h = window.innerHeight / 4;
    const mapW = GameState.officeLevel >= 3 ? (450 + (GameState.openSpaceBlocks * 320) + 150) : (GameState.officeLevel === 2 ? 500 : 280);
    const mapH = GameState.officeLevel >= 2 ? 300 : 200;
    
    const checkCollision = (newX: number, newY: number) => {
      // Character footprint bounding box
      const pr = { left: newX - 8, right: newX + 8, top: newY - 4, bottom: newY + 4 };
      
      // Screen bounds (Wall at the top is ~40px high)
      if (pr.left < 0 || pr.right > mapW || pr.top < 40 || pr.bottom > mapH) return true;
      
      const boxes = [];
      const deskW = 50; const deskD = 15;
      
      if (GameState.officeLevel === 1) {
        boxes.push({ left: 10, right: 10 + 30, top: 45, bottom: 90 }); // Bed
        boxes.push({ left: mapW / 2 - deskW / 2, right: mapW / 2 + deskW / 2, top: mapH / 2 + 10 - deskD, bottom: mapH / 2 + 10 }); // Desk
        boxes.push({ left: mapW - 50, right: mapW, top: mapH - 20 - 15, bottom: mapH - 20 }); // Student Kitchen
      } else {
        if (GameState.officeLevel === 2) {
          boxes.push({ left: 20, right: 70, top: mapH - 40 - 15, bottom: mapH - 40 }); // Babyfoot L2
        }
        boxes.push({ left: 20, right: 20 + 15, top: 40 - 10, bottom: 40 }); // Plant gauche
        boxes.push({ left: 108, right: 108 + 12, top: 55 - 12, bottom: 55 }); // Plant droite
        boxes.push({ left: 50, right: 50 + 40, top: 60 - 15, bottom: 60 }); // Sofa
        boxes.push({ left: 55, right: 55 + 40, top: 95 - 15, bottom: 95 }); // Coffee Table
        boxes.push({ left: mapW - 80, right: mapW - 80 + 60, top: 45 - 10, bottom: 45 }); // Counter
        boxes.push({ left: mapW - 100, right: mapW - 100 + 12, top: 50 - 8, bottom: 50 }); // Water cooler
        
        if (GameState.officeLevel >= 3) {
          // Salle de réunion
          boxes.push({ left: 40, right: 120, top: 210 - 40, bottom: 210 }); // Table réunion
          boxes.push({ left: 20, right: 32, top: 205 - 15, bottom: 205 }); // Dir Ops
          boxes.push({ left: 128, right: 140, top: 205 - 15, bottom: 205 }); // Dir Sales
          // Chaises haut
          boxes.push({ left: 50, right: 62, top: 180 - 10, bottom: 180 });
          boxes.push({ left: 75, right: 87, top: 180 - 10, bottom: 180 });
          boxes.push({ left: 100, right: 112, top: 180 - 10, bottom: 180 });
          // Chaises bas
          boxes.push({ left: 50, right: 62, top: 240 - 10, bottom: 240 });
          boxes.push({ left: 75, right: 87, top: 240 - 10, bottom: 240 });
          boxes.push({ left: 100, right: 112, top: 240 - 10, bottom: 240 });
          
          // Assistant
          const aX = 285;
          const aY = mapH / 2 - 40;
          boxes.push({ left: aX - 25, right: aX + 25, top: aY - 5 - 15, bottom: aY - 5 }); // Desk
          boxes.push({ left: aX - 8, right: aX + 8, top: aY + 2 - 10, bottom: aY + 2 }); // Chair
        }
        
        // Partition walls
        if (GameState.officeLevel >= 3) {
          for (let b = 0; b <= GameState.openSpaceBlocks; b++) {
            const partitionX = 430 + (b * 320) - 5;
            boxes.push({ left: partitionX, right: partitionX + 5, top: 40, bottom: mapH / 2 - 30 });
            boxes.push({ left: partitionX, right: partitionX + 5, top: mapH / 2 + 30, bottom: mapH });
          }
        }
        
        const physicsDeskCount = GameState.officeLevel === 1 ? Math.min(GameState.deskCount, 1) : (GameState.officeLevel === 2 ? Math.min(GameState.deskCount, 6) : GameState.deskCount);
        for (let i = 0; i < physicsDeskCount; i++) {
          let deskX, deskY;
          if (GameState.officeLevel === 2) {
            const cols = 3;
            const col = i % cols;
            const row = Math.floor(i / cols);
            const marginX = deskW + 40;
            const marginY = deskD + 70;
            const totalW = (cols - 1) * marginX + deskW;
            const startX = (mapW - totalW) / 2;
            deskX = startX + (col * marginX);
            deskY = 90 + row * marginY;
          } else {
            // Level 3
            if (i === 0) {
              deskX = 250;
              deskY = mapH / 2;
            } else {
              const empIdx = i - 1;
              const blockIdx = Math.floor(empIdx / 9);
              const idxInBlock = empIdx % 9;
              const cols = 3; // 3 cols, 3 rows per block
              const col = idxInBlock % cols;
              const row = Math.floor(idxInBlock / cols);
              const startX = 450 + (blockIdx * 320);
              const marginX = deskW + 60;
              const marginY = deskD + 60;
              deskX = startX + (col * marginX);
              deskY = 90 + row * marginY;
            }
          }
          
          const finalDeskW = (GameState.officeLevel >= 3 && i === 0) ? deskW + 20 : deskW;
          const finalDeskD = (GameState.officeLevel >= 3 && i === 0) ? deskD + 5 : deskD;
          boxes.push({ left: deskX, right: deskX + finalDeskW, top: deskY - finalDeskD, bottom: deskY });

          // Collision de la chaise
          const charX = deskX + (GameState.officeLevel >= 3 && i === 0 ? (deskW + 20) / 2 : deskW / 2);
          const charY = deskY + 15;
          if (GameState.officeLevel >= 3 && i === 0) {
            boxes.push({ left: charX - 12, right: charX + 12, top: charY - 12, bottom: charY });
          } else {
            boxes.push({ left: charX - 10, right: charX + 10, top: charY - 10, bottom: charY });
          }
        }
      }
      
      for (const b of boxes) {
        if (pr.right > b.left && pr.left < b.right && pr.bottom > b.top && pr.top < b.bottom) {
          return true; // Intersection detected
        }
      }
      return false;
    };
    
    // Move on X independently from Y (Slide effect along walls)
    if (dx !== 0) {
      if (!checkCollision(GameState.playerPos.x + dx, GameState.playerPos.y)) {
        GameState.playerPos.x += dx;
      }
    }
    if (dy !== 0) {
      if (!checkCollision(GameState.playerPos.x, GameState.playerPos.y + dy)) {
        GameState.playerPos.y += dy;
      }
    }

    // Soft repulsion from employees to prevent overlapping
    for (const info of GameState.employeesInfo.values()) {
      if (info.state !== 'off_duty') {
        const dist = Math.hypot(GameState.playerPos.x - info.x, GameState.playerPos.y - info.y);
        if (dist < 16 && dist > 0) {
          const overlap = 16 - dist;
          GameState.playerPos.x += ((GameState.playerPos.x - info.x) / dist) * overlap * 0.2;
          GameState.playerPos.y += ((GameState.playerPos.y - info.y) / dist) * overlap * 0.2;
        }
      }
    }
    
    // Audio: Bruit de fond du Datacenter
    if (GameState.officeLevel >= 3 && GameState.purchasedPoles.includes('datacenter')) {
      const idx = GameState.purchasedPoles.indexOf('datacenter');
      const b = idx + 2;
      const startX = 430 + ((b - 1) * 320);
      const poleCenterX = startX + 140;
      const poleCenterY = mapH / 2;
      const dist = Math.hypot(GameState.playerPos.x - poleCenterX, GameState.playerPos.y - poleCenterY);
      audioEngine.updateServerSoundVolume(dist);
    } else {
      audioEngine.stopServerSound();
    }

    GameState.actionKeyPrevious = GameState.actionKey;
  },
  (interpolation) => {
    // Render
    renderer.render(interpolation);
    
    // Update UI Progress
    if (GameState.projectInfos.size > 0 || ui.isProjectProgressWindowOpen()) {
      ui.updateProjectProgressWindow();
    }
  }
);

gameLoop.start();

// Show Continue button if save exists
if (SaveManager.hasSave()) {
  document.getElementById('btn-continue')!.style.display = 'block';
}
// Start screen is shown by default via HTML/CSS, wait for user input to unpause
GameState.isPaused = true;
