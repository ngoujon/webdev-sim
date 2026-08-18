import { defineQuery, removeEntity } from 'bitecs';
import { Project, Employee } from './components';
import { GameState } from './gameState';
import { EventBus } from '../core/EventBus';

const projectQuery = defineQuery([Project]);
const employeeQuery = defineQuery([Employee]);

export function createTimeSystem() {
  let timeAccumulator = 0;
  return (world: any, dt: number) => {
    // Determine time multiplier based on player position (Bed/Sofa)
    let timeMultiplier = 1;
    if (GameState.playerActionState === 'sleeping') {
      timeMultiplier = 10; // Accélère le temps pendant le sommeil
    }

    // 1 heure de jeu = 5 secondes IRL (accéléré si timeMultiplier > 1)
    timeAccumulator += dt * timeMultiplier;
    if (timeAccumulator >= 5000) {
      timeAccumulator -= 5000;
      GameState.timeOfDay += 1;
      
      if (GameState.timeOfDay >= 24) {
        GameState.timeOfDay = 0;
        GameState.day += 1;
        
        // Loyer, Électricité, Hébergement et Salaires hebdomadaires (tous les 7 jours)
        if (GameState.day % 7 === 0) {
          const rent = GameState.officeLevel === 1 ? 150 : (GameState.officeLevel === 2 ? 700 : 1500);
          GameState.addMoney(-rent, "Loyer");

          const electricity = GameState.deskCount * 50;
          GameState.addMoney(-electricity, "Facture d'électricité");

          let hosting = 0;
          if (!GameState.purchasedPoles.includes('datacenter')) {
            hosting = GameState.officeLevel === 1 ? 100 : (GameState.officeLevel === 2 ? 300 : 800);
            GameState.addMoney(-hosting, "Frais d'hébergement serveur");
          }
          
          let totalSalaries = 0;
          for (const [, info] of GameState.employeesInfo.entries()) {
            totalSalaries += info.salary;
          }
          if (totalSalaries > 0) {
            GameState.addMoney(-totalSalaries, "Salaires employés");
          }
          
          EventBus.emit('RENT_PAID', { amount: rent, salaries: totalSalaries, electricity, hosting, officeLevel: GameState.officeLevel });
        }
        
        // Check for required patches on completed projects
        for (const p of GameState.completedProjects) {
          if (p.nextPatchDay === GameState.day) {
            EventBus.emit('PATCH_REQUIRED', { title: p.title });
            p.nextPatchDay += 7; // Prochain patch dans 7 jours
          }
        }
        
        // Check deadlines at midnight
        const projects = projectQuery(world);
        for (let eid of projects) {
          const info = GameState.projectInfos.get(eid);
          if (info && GameState.day > info.deadlineDay && Project.isCompleted[eid] === 0) {
            // Deadline missed
            GameState.addMoney(-info.budget / 2, "Pénalité retard: " + info.title); // Penalité de moitié du budget
            GameState.reputation = Math.max(0, GameState.reputation - 20);
            EventBus.emit('PROJECT_FAILED', { title: info.title, budget: info.budget });
            GameState.projectInfos.delete(eid);
            removeEntity(world, eid);
          }
        }
        
        // Refresh recruitment candidates
        GameState.generateCandidates();

        // Check retirement
        const retiringEids: number[] = [];
        for (const [eid, info] of GameState.employeesInfo.entries()) {
          if (info.retireAtDay && info.retireAtDay <= GameState.day) {
            retiringEids.push(eid);
          }
        }
        
        for (const eid of retiringEids) {
          const emp = GameState.employeesInfo.get(eid)!;
          GameState.employeesInfo.delete(eid);
          removeEntity(world, eid);
          GameState.employeesCount--;
          
          import('../core/EventBus').then(m => m.EventBus.emit('EMPLOYEE_RETIRED', { title: emp.title, role: emp.role, level: emp.level }));
        }
        
        // Refresh contracts
        GameState.availableContracts = [];
        import('../core/EventBus').then(m => m.EventBus.emit('REQUEST_CONTRACTS'));

        // Reset daily actions
        GameState.hasReadBookToday = false;
      }
      
      EventBus.emit('TIME_TICK', { day: GameState.day, time: GameState.timeOfDay });
    }
    
    return world;
  };
}

export function createNeedsSystem() {
  let needsAccumulator = 0;
  let actionSfxAccumulator = 0;
  return (world: any, dt: number) => {
    // Determine player position zones
    const px = GameState.playerPos.x;
    const py = GameState.playerPos.y;
    const mapW = GameState.officeLevel >= 3 ? (450 + (GameState.openSpaceBlocks * 320) + 150) : (GameState.officeLevel === 2 ? 500 : 280);
    const mapH = GameState.officeLevel >= 2 ? 300 : 200;
    let onBed = false;
    let nearFood = false;
    let nearDrink = false;
    let nearToilet = false;
    let nearAssistant = false;
    let nearOpsDirector = false;
    let nearSalesDirector = false;
    let nearTennis = false;
    let nearBookcase = false;
    let nearBabyfoot = false;
    let nearCleaningStation = false;
    
    if (GameState.officeLevel === 1) {
      // Lit (Interaction plus large que les collisions)
      if (px > 0 && px < 60 && py > 35 && py < 110) onBed = true; 
      if (px > mapW - 60 && py > mapH - 50) { nearFood = true; nearDrink = true; } // Petite cuisine étudiant
      if (px > mapW - 40 && py > mapH / 2 - 40 && py < mapH / 2 + 40) nearToilet = true; // Toilettes
      if (px < 40 && py > mapH - 40) nearTennis = true; // Balle de tennis
      if (px > mapW / 2 + 30 && px < mapW / 2 + 70 && py < 80) nearBookcase = true; // Bibliothèque
    } else {
      if (px > 30 && px < 110 && py > 0 && py < 80) onBed = true; // Canapé
      if (px > mapW - 120 && py > 0 && py < 80) { nearFood = true; nearDrink = true; } // Cafétéria + Fontaine
      if (px > mapW - 160 && px < mapW - 110 && py < 60) nearToilet = true; // Toilettes
      if (px > mapW - 60 && py > mapH - 80) nearCleaningStation = true; // Station de nettoyage en bas à droite L2/L3
      
      if (px > 40 && px < 100 && py > 75 && py < 110) nearBookcase = true; // Livres sur la table basse L2/L3

      if (GameState.officeLevel === 2) {
        if (px > 0 && px < 80 && py > mapH - 80) nearBabyfoot = true; // Babyfoot en bas à gauche L2
      }

      if (GameState.officeLevel >= 3) {
        if (Math.hypot(px - 285, py - (mapH / 2 - 40)) < 40) {
          nearAssistant = true;
        }
        if (Math.hypot(px - 25, py - 210) < 30) {
          nearOpsDirector = true;
        }
        if (Math.hypot(px - 130, py - 210) < 30) {
          nearSalesDirector = true;
        }
      }
    }

    if (nearOpsDirector) GameState.nearInteractable = 'ops_director';
    else if (nearSalesDirector) GameState.nearInteractable = 'sales_director';
    else if (nearAssistant) GameState.nearInteractable = 'assistant';
    else if (nearTennis) GameState.nearInteractable = 'tennis';
    else if (nearBabyfoot) GameState.nearInteractable = 'babyfoot';
    else if (nearCleaningStation) GameState.nearInteractable = 'cleaning_station';
    else if (nearBookcase) GameState.nearInteractable = 'bookcase';
    else if (onBed) GameState.nearInteractable = 'bed';
    else if (nearFood || nearDrink) GameState.nearInteractable = 'food';
    else if (nearToilet) GameState.nearInteractable = 'toilet';
    else GameState.nearInteractable = null;

    const isActionJustPressed = GameState.actionKey && !GameState.actionKeyPrevious;

    if (GameState.playerActionState === 'idle') {
      if (isActionJustPressed) {
        if (nearOpsDirector) {
          import('../core/EventBus').then(m => m.EventBus.emit('OPEN_OPS_MENU'));
          GameState.actionKeyPrevious = true;
        } else if (nearSalesDirector) {
          import('../core/EventBus').then(m => m.EventBus.emit('OPEN_SALES_DIR_MENU'));
          GameState.actionKeyPrevious = true;
        } else if (nearAssistant) {
          import('../core/EventBus').then(m => m.EventBus.emit('OPEN_ASSISTANT_MENU'));
          GameState.actionKeyPrevious = true; // prevent multiple triggers
        } else if (nearCleaningStation) {
          import('../core/EventBus').then(m => m.EventBus.emit('OPEN_CLEANER_MENU'));
          GameState.actionKeyPrevious = true;
        } else if (nearToilet && GameState.needs.bladder > 0) {
          if (!GameState.isToiletOccupied) {
            GameState.isToiletOccupied = true;
            GameState.playerActionState = 'toilet';
            GameState.actionTimer = 2000;
          } else {
            // Just wait, maybe could trigger a UI notification but this is fine for now
          }
        } else if (nearTennis) {
          GameState.playerActionState = 'playing_tennis';
          GameState.actionTimer = 3000;
          GameState.playerDir = 'left';
        } else if (nearBabyfoot) {
          GameState.playerActionState = 'playing_babyfoot';
          GameState.actionTimer = 5000;
          GameState.playerDir = 'down';
          
          // Trouver un salarié disponible pour jouer
          const availableEmployees: number[] = [];
          for (const [eid, info] of GameState.employeesInfo.entries()) {
            if (info.state === 'working' || info.state === 'moving_to_desk') {
              availableEmployees.push(eid);
            }
          }
          if (availableEmployees.length > 0) {
            const chosenEid = availableEmployees[Math.floor(Math.random() * availableEmployees.length)];
            const chosenInfo = GameState.employeesInfo.get(chosenEid);
            if (chosenInfo) {
              chosenInfo.state = 'moving_to_babyfoot';
            }
          }
        } else if (nearBookcase && !GameState.hasReadBookToday) {
          GameState.playerActionState = 'reading';
          GameState.actionTimer = 2000;
          GameState.playerDir = 'up';
        } else if ((nearFood || nearDrink) && (GameState.needs.hunger < 100 || GameState.needs.thirst < 100)) {
          GameState.playerActionState = 'eating';
          GameState.actionTimer = 1500;
        } else if (onBed && GameState.needs.energy < 100) {
          GameState.playerActionState = 'sleeping';
          GameState.actionTimer = 3500; // 7h in-game at x10 speed
        }
      }
    } else {
      if (isActionJustPressed && GameState.playerActionState === 'sleeping') {
        // Wake up early
        GameState.actionTimer = 0;
      }
      
      // Process action
      GameState.actionTimer -= dt;
      actionSfxAccumulator += dt;
      if (actionSfxAccumulator >= 500) {
        actionSfxAccumulator -= 500;
        import('../audio/AudioEngine').then(m => m.audioEngine.playActionSound(GameState.playerActionState));
      }

      if (GameState.actionTimer <= 0) {
        if (GameState.playerActionState === 'toilet') {
          GameState.needs.bladder = 0;
          GameState.isToiletOccupied = false;
        } else if (GameState.playerActionState === 'eating') {
          GameState.needs.hunger = 100;
          GameState.needs.thirst = 100;
          GameState.fridgeDirt = Math.min(100, GameState.fridgeDirt + 5);
        } else if (GameState.playerActionState === 'playing_tennis') {
          GameState.needs.energy = Math.max(0, GameState.needs.energy - 5);
        } else if (GameState.playerActionState === 'playing_babyfoot') {
          GameState.needs.energy = Math.max(0, GameState.needs.energy - 10);
        } else if (GameState.playerActionState === 'reading') {
          GameState.hasReadBookToday = true;
          GameState.addXp(50); // Gagne un peu d'XP
          import('../audio/AudioEngine').then(m => m.audioEngine.playSuccessSound());
        }
        // Energy is regained progressively
        GameState.playerActionState = 'idle';
        EventBus.emit('NEEDS_CHANGED');
      }
    }

    needsAccumulator += dt;
    if (needsAccumulator >= 500) { // Tick de 0.5 secondes pour des barres fluides
      needsAccumulator -= 500;
      
      const isDay = GameState.timeOfDay >= 9 && GameState.timeOfDay < 18;
      
      // Energy
      let drainEnergy = isDay ? 0.125 : 0.05; 
      if (GameState.playerActionState === 'sleeping') {
        GameState.needs.energy = Math.min(100, GameState.needs.energy + 14.3); // 100% en 7 heures (7 ticks)
      } else {
        if (!isDay && GameState.isPlayerAtDesk && GameState.projectInfos.size > 0) {
          drainEnergy = 0.5; // Fatigue intense
        }
        if (GameState.hasPremiumCoffee) drainEnergy *= 0.7; // -30% fatigue
        GameState.needs.energy = Math.max(0, GameState.needs.energy - drainEnergy);
      }
      
      // Hunger
      const drainHunger = isDay ? 0.25 : 0.125;
      GameState.needs.hunger = Math.max(0, GameState.needs.hunger - drainHunger);
      
      // Thirst
      const drainThirst = isDay ? 0.375 : 0.125;
      GameState.needs.thirst = Math.max(0, GameState.needs.thirst - drainThirst);
      
      // Bladder (Vessie : 0% = vide, 100% = pleine/danger)
      const fillBladder = isDay ? 0.25 : 0.125;
      GameState.needs.bladder = Math.min(100, GameState.needs.bladder + fillBladder);
      
      EventBus.emit('NEEDS_CHANGED');
    }
    
    return world;
  };
}

export function createEmployeeSystem() {
  return (world: any, dt: number) => {
    const employees = employeeQuery(world);
    const time = GameState.timeOfDay;

    const mapW = GameState.officeLevel >= 3 ? (450 + (GameState.openSpaceBlocks * 320) + 150) : (GameState.officeLevel === 2 ? 500 : 280);
    const mapH = GameState.officeLevel >= 2 ? 300 : 200;
    
    // Points of interest
    const foodX = mapW - 40; const foodY = 45 + 20; // Fridge front
    const toiletX = GameState.officeLevel === 1 ? mapW - 25 : mapW - 135; 
    const toiletY = GameState.officeLevel === 1 ? mapH / 2 + 10 : 45; // Toilet front
    const doorX = mapW / 2; const doorY = mapH + 20; // Exit door

    let peopleEating = 0;
    for (const info of GameState.employeesInfo.values()) {
      if (info.state === 'moving_to_food' || info.state === 'eating') {
        peopleEating++;
      }
    }

    for (let emp of employees) {
      if (emp === GameState.playerEid) continue;

      const info = GameState.employeesInfo.get(emp);
      if (!info) continue;

      const isCleaner = info.role === 'cleaner';
      const myWorkHours = isCleaner ? (time >= 20 || time < 6) : (time >= 9 && time < 18);

      // 1. AI Decision Making
      if (info.state === 'working' || info.state === 'off_duty') {
        if (myWorkHours) {
          if (info.state === 'off_duty') {
             info.x = doorX; info.y = doorY;
             info.state = isCleaner ? 'working' : 'moving_to_desk';
             if (isCleaner) {
               // Initial random target for cleaner
               info.targetX = 20 + Math.random() * (mapW - 40);
               info.targetY = 20 + Math.random() * (mapH - 40);
             }
          } else {
             // Working -> check needs (Cleaners don't have needs for simplicity, they just work)
             if (!isCleaner) {
               info.hunger = Math.max(0, info.hunger - (dt / 500) * 0.5);
               info.thirst = Math.max(0, info.thirst - (dt / 500) * 0.6);
               info.bladder = Math.min(100, info.bladder + (dt / 500) * 0.5);

               if (info.bladder >= 90) {
                 info.state = 'moving_to_toilet';
               } else if (info.hunger <= 20 || info.thirst <= 20) {
                 info.state = 'moving_to_food';
                 peopleEating++;
               } else if (time >= 12 && time < 14 && info.hunger < 80) {
                 // Lunch break! Max 5 employees eating at once
                 if (peopleEating < 5) {
                   info.state = 'moving_to_food';
                   peopleEating++;
                 }
               }

               // Increase dirt slightly
               const dirtRate = GameState.hasTrashCans ? 0.00015 : 0.0005;
               GameState.officeDirt = Math.min(100, GameState.officeDirt + dt * dirtRate);
             } else {
               // Cleaner is working, reduce dirt!
               GameState.officeDirt = Math.max(0, GameState.officeDirt - dt * 0.005);
               GameState.fridgeDirt = Math.max(0, GameState.fridgeDirt - dt * 0.01);
             }

             // Sales logic
             if (info.role === 'sales') {
               if (info.salesTimer === undefined) info.salesTimer = 0;
               info.salesTimer += dt;
               // Environ toutes les 5 heures in-game (25000ms IRL au ralenti normal)
               if (info.salesTimer >= 25000) {
                 info.salesTimer = 0;
                 EventBus.emit('SALES_GENERATED_CONTRACT');
               }
             }
          }
        } else {
          // Off work
          if (info.state === 'working') {
            info.state = 'leaving';
          }
        }
      }

      // 2. Set Targets
      let targetX = info.targetX;
      let targetY = info.targetY;
      
      if (info.state === 'moving_to_desk') {
         const deskW = 50; const deskD = 15;
         
         if (GameState.officeLevel === 1) {
           targetX = mapW / 2;
           targetY = mapH / 2 + 10 + 15;
         } else if (GameState.officeLevel === 2) {
           const cols = 3;
           const col = info.deskIndex % cols;
           const row = Math.floor(info.deskIndex / cols);
           const marginX = deskW + 40;
           const marginY = deskD + 70;
           const totalW = (cols - 1) * marginX + deskW;
           const startX = (mapW - totalW) / 2;
           targetX = startX + (col * marginX) + deskW / 2;
           targetY = 90 + row * marginY + 15;
         } else {
           // Level 3
           if (info.deskIndex === 0) {
             targetX = 250 + (deskW + 20) / 2;
             targetY = mapH / 2 + 15;
           } else {
             const empIdx = info.deskIndex - 1;
             const blockIdx = Math.floor(empIdx / 9);
             const idxInBlock = empIdx % 9;
             const cols = 3; // 3 cols, 3 rows per block
             const col = idxInBlock % cols;
             const row = Math.floor(idxInBlock / cols);
             const startX = 450 + (blockIdx * 320);
             const marginX = deskW + 60;
             const marginY = deskD + 60;
             targetX = startX + (col * marginX) + deskW / 2;
             targetY = 90 + row * marginY + 15;
           }
         }
      } else if (info.state === 'moving_to_food') {
         targetX = foodX; targetY = foodY;
      } else if (info.state === 'moving_to_toilet') {
         targetX = toiletX; targetY = toiletY;
      } else if (info.state === 'moving_to_babyfoot') {
         targetX = 45; targetY = mapH - 60;
      } else if (info.state === 'leaving') {
         targetX = doorX; targetY = doorY;
      } else if (isCleaner && info.state === 'working') {
         targetX = info.targetX; targetY = info.targetY;
      }

      // 3. Movement
      info.isMoving = false;
      const speed = 0.12 * dt; // Slightly slower than player
      if (['moving_to_desk', 'moving_to_food', 'moving_to_toilet', 'leaving', 'moving_to_babyfoot'].includes(info.state) || (isCleaner && info.state === 'working')) {
         const dx = targetX - info.x;
         const dy = targetY - info.y;
         const dist = Math.hypot(dx, dy);

         if (dist > 5) {
            info.isMoving = true;
            info.x += (dx / dist) * speed;
            info.y += (dy / dist) * speed;
            
            // Soft repulsion from player
            const pDist = Math.hypot(info.x - GameState.playerPos.x, info.y - GameState.playerPos.y);
            if (pDist < 16 && pDist > 0) {
               const overlap = 16 - pDist;
               info.x += ((info.x - GameState.playerPos.x) / pDist) * overlap * 0.2;
               info.y += ((info.y - GameState.playerPos.y) / pDist) * overlap * 0.2;
            }

            // Soft repulsion from other employees
            for (const [otherEid, otherInfo] of GameState.employeesInfo.entries()) {
               if (otherEid !== emp && otherInfo.state !== 'off_duty') {
                  const oDist = Math.hypot(info.x - otherInfo.x, info.y - otherInfo.y);
                  if (oDist < 16 && oDist > 0) {
                     const overlap = 16 - oDist;
                     info.x += ((info.x - otherInfo.x) / oDist) * overlap * 0.2;
                     info.y += ((info.y - otherInfo.y) / oDist) * overlap * 0.2;
                  }
               }
            }

            if (Math.abs(dx) > Math.abs(dy)) {
               info.dir = dx > 0 ? 'right' : 'left';
            } else {
               info.dir = dy > 0 ? 'down' : 'up';
            }
         } else {
            // Arrived
            if (info.state === 'moving_to_desk') info.state = 'working';
            if (info.state === 'moving_to_food') {
               info.state = 'eating'; info.actionTimer = 2000;
            }
            if (info.state === 'moving_to_toilet') {
               if (!GameState.isToiletOccupied) {
                 GameState.isToiletOccupied = true;
                 info.state = 'toilet'; info.actionTimer = 2000;
               } else {
                 info.isMoving = false; // Queue up / wait
               }
            }
            if (info.state === 'leaving') info.state = 'off_duty';
            if (info.state === 'moving_to_babyfoot') {
               info.state = 'playing_babyfoot';
               info.actionTimer = 5000;
               info.dir = 'up'; // Regarde le babyfoot depuis le bas
            }
            if (isCleaner && info.state === 'working') {
               // Pick a new spot to clean
               info.targetX = 20 + Math.random() * (mapW - 40);
               info.targetY = 20 + Math.random() * (mapH - 40);
            }
         }
      }

      // 4. Action execution
      if (info.state === 'eating' || info.state === 'toilet' || info.state === 'playing_babyfoot') {
         info.actionTimer -= dt;
         if (info.actionTimer <= 0) {
            if (info.state === 'eating') {
              info.hunger = 100;
              info.thirst = 100;
              GameState.fridgeDirt = Math.min(100, GameState.fridgeDirt + 5);
            }
            if (info.state === 'toilet') {
              info.bladder = 0;
              GameState.isToiletOccupied = false;
            }
            // playing_babyfoot doesn't have specific employee needs right now, but we just let them go back to desk
            info.state = 'moving_to_desk';
         }
      }
    }
    return world;
  };
}

export function createWorkSystem() {
  return (world: any, dt: number) => {
    const projects = projectQuery(world);
    const employees = employeeQuery(world);
    
    if (projects.length === 0 || employees.length === 0) return world;

    const isPlayerAtDesk = GameState.isPlayerAtDesk;
    GameState.activeProjects = [];

    const dtSeconds = (dt / 1000) * 5;
    const employeeWorked = new Set<number>();
    const playerMultiplier = Math.max(0.1, (GameState.concentration / 100) * 1.5);

    for (let eid of projects) {
      const info = GameState.projectInfos.get(eid);
      if (!info) continue;

      let dFe = 0, dBe = 0, dDes = 0;

      let currentPhase = 'completed';
      if (Project.progressFrontend[eid] < Project.totalFrontend[eid]) currentPhase = 'fe';
      else if (Project.progressBackend[eid] < Project.totalBackend[eid]) currentPhase = 'be';
      else if (Project.progressDesign[eid] < Project.totalDesign[eid]) currentPhase = 'des';

      if (currentPhase !== 'completed') {
        for (let emp of employees) {
          if (employeeWorked.has(emp)) continue;

          const isPlayer = emp === GameState.playerEid;
          
          if (isPlayer) {
            // Le joueur doit être au bureau pour travailler
            if (!isPlayerAtDesk) continue;
          } else {
            // Les employés doivent être au statut "working"
            const empInfo = GameState.employeesInfo.get(emp);
            if (!empInfo || empInfo.state !== 'working') continue;
            if (GameState.timeOfDay < 9 || GameState.timeOfDay >= 18) continue;
          }

          let empMultiplier = 1;
          if (isPlayer) {
            empMultiplier = playerMultiplier;
          } else {
            const empInfo = GameState.employeesInfo.get(emp);
            if (empInfo) {
              const bladderScore = 100 - empInfo.bladder;
              const minNeed = Math.min(empInfo.hunger, empInfo.thirst, bladderScore);
              const concentration = (minNeed < 10) ? minNeed : (empInfo.hunger + empInfo.thirst + bladderScore) / 3;
              empMultiplier = Math.max(0.1, (concentration / 100) * 1.5);
            }
          }

          if (GameState.hasDoubleScreens) empMultiplier *= 1.25; // +25% work speed
          
          const feSkill = Employee.frontendSkill[emp] * empMultiplier * dtSeconds;
          const beSkill = Employee.backendSkill[emp] * empMultiplier * dtSeconds;
          const desSkill = Employee.designSkill[emp] * empMultiplier * dtSeconds;

          if (currentPhase === 'fe' && feSkill > 0) {
            dFe += feSkill;
            employeeWorked.add(emp);
          } else if (currentPhase === 'be' && beSkill > 0) {
            dBe += beSkill;
            employeeWorked.add(emp);
          } else if (currentPhase === 'des' && desSkill > 0) {
            dDes += desSkill;
            employeeWorked.add(emp);
          }

          // Add XP to employees
          if (!isPlayer && employeeWorked.has(emp)) {
            const empInfo = GameState.employeesInfo.get(emp);
            if (empInfo) {
              empInfo.xp += dtSeconds * 5; // 5 XP par seconde passée à travailler
              if (empInfo.xp >= empInfo.xpToNextLevel) {
                empInfo.xp -= empInfo.xpToNextLevel;
                empInfo.level += 1;
                empInfo.xpToNextLevel = Math.floor(empInfo.xpToNextLevel * 1.5);

                // Increase skills based on role
                if (empInfo.role === 'dev') {
                  Employee.frontendSkill[emp] += 1;
                  Employee.backendSkill[emp] += 1;
                } else if (empInfo.role === 'designer') {
                  Employee.designSkill[emp] += 1;
                }

                import('../core/EventBus').then(m => m.EventBus.emit('EMPLOYEE_LEVEL_UP', { title: empInfo.title, level: empInfo.level }));
              }
            }
          }

          // Le joueur progresse aussi en compétence, dans la discipline sur laquelle il travaille
          if (isPlayer && employeeWorked.has(emp)) {
            const skillKey = currentPhase === 'fe' ? 'frontend' : currentPhase === 'be' ? 'backend' : 'design';
            GameState.playerSkillXp[skillKey] += dtSeconds * 5; // même rythme que les employés
            if (GameState.playerSkillXp[skillKey] >= GameState.playerSkillXpToNextLevel[skillKey]) {
              GameState.playerSkillXp[skillKey] -= GameState.playerSkillXpToNextLevel[skillKey];
              GameState.playerSkillXpToNextLevel[skillKey] = Math.floor(GameState.playerSkillXpToNextLevel[skillKey] * 1.5);

              const skillColumn = skillKey === 'frontend' ? Employee.frontendSkill : skillKey === 'backend' ? Employee.backendSkill : Employee.designSkill;
              skillColumn[emp] += 1;

              const skillLabel = skillKey === 'frontend' ? 'Frontend' : skillKey === 'backend' ? 'Backend' : 'Design';
              import('../core/EventBus').then(m => m.EventBus.emit('PLAYER_SKILL_LEVEL_UP', { skill: skillLabel, level: skillColumn[emp] }));
            }
          }
        }
      }

      if (Project.progressFrontend[eid] < Project.totalFrontend[eid]) {
        Project.progressFrontend[eid] = Math.min(Project.totalFrontend[eid], Project.progressFrontend[eid] + dFe);
      } else if (Project.progressBackend[eid] < Project.totalBackend[eid]) {
        Project.progressBackend[eid] = Math.min(Project.totalBackend[eid], Project.progressBackend[eid] + dBe);
      } else if (Project.progressDesign[eid] < Project.totalDesign[eid]) {
        Project.progressDesign[eid] = Math.min(Project.totalDesign[eid], Project.progressDesign[eid] + dDes);
      } else {
        if (Project.isCompleted[eid] === 0) {
          Project.isCompleted[eid] = 1;
          GameState.addMoney(info.budget, "Livraison: " + info.title);
          GameState.addXp(Math.floor(info.budget / 10));
          GameState.reputation += 10;
          
          if (!info.title.startsWith("Correctif")) {
            GameState.completedProjects.push({
              title: info.title,
              budget: info.budget,
              nextPatchDay: GameState.day + 7
            });
          }

          EventBus.emit('PROJECT_COMPLETED', { title: info.title, budget: info.budget });
          GameState.projectInfos.delete(eid);
          removeEntity(world, eid);
          continue; // Skip adding to activeProjects array
        }
      }

      // Add to array for UI
      GameState.activeProjects.push({
        eid,
        title: info.title,
        budget: info.budget,
        deadlineDay: info.deadlineDay,
        progress: {
          fe: Project.progressFrontend[eid], totalFe: Project.totalFrontend[eid],
          be: Project.progressBackend[eid], totalBe: Project.totalBackend[eid],
          des: Project.progressDesign[eid], totalDes: Project.totalDesign[eid]
        }
      });
    }
    
    return world;
  };
}
