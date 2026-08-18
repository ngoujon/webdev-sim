import { GameState } from '../sim/gameState';
import { EventBus } from '../core/EventBus';
import { world } from '../sim/world';
import { Project, Employee } from '../sim/components';
import { addEntity, addComponent } from 'bitecs';

const SAVE_KEY = 'webdev_tycoon_save';

// Nombre max de transactions conservées en sauvegarde pour éviter une croissance illimitée
const MAX_SAVED_TRANSACTIONS = 200;

export class SaveManager {
  static save() {
    const employees = [];
    for (const [eid, info] of GameState.employeesInfo.entries()) {
      employees.push({
        ...info,
        frontendSkill: Employee.frontendSkill[eid],
        backendSkill: Employee.backendSkill[eid],
        designSkill: Employee.designSkill[eid],
      });
    }

    const projects = [];
    for (const [eid, info] of GameState.projectInfos.entries()) {
      projects.push({
        title: info.title,
        budget: info.budget,
        deadlineDay: info.deadlineDay,
        totalFrontend: Project.totalFrontend[eid],
        totalBackend: Project.totalBackend[eid],
        totalDesign: Project.totalDesign[eid],
        progressFrontend: Project.progressFrontend[eid],
        progressBackend: Project.progressBackend[eid],
        progressDesign: Project.progressDesign[eid],
      });
    }

    const dataToSave = {
      money: GameState.money,
      reputation: GameState.reputation,
      day: GameState.day,
      timeOfDay: GameState.timeOfDay,
      officeLevel: GameState.officeLevel,
      deskCount: GameState.deskCount,
      employeesCount: GameState.employeesCount,
      playerPos: GameState.playerPos,
      level: GameState.level,
      xp: GameState.xp,
      xpToNextLevel: GameState.xpToNextLevel,
      needs: GameState.needs,
      openedWindows: GameState.openedWindows,
      availableCandidates: GameState.availableCandidates,
      availableContracts: GameState.availableContracts,
      purchasedPoles: GameState.purchasedPoles,
      officeDirt: GameState.officeDirt,
      fridgeDirt: GameState.fridgeDirt,
      hasDoubleScreens: GameState.hasDoubleScreens,
      hasTrashCans: GameState.hasTrashCans,
      hasPremiumCoffee: GameState.hasPremiumCoffee,
      hasAssistant: GameState.hasAssistant,
      hasOperationsDirector: GameState.hasOperationsDirector,
      hasSalesDirector: GameState.hasSalesDirector,
      hasReadBookToday: GameState.hasReadBookToday,
      hasCleaner: GameState.hasCleaner,
      employees,
      projects,
      completedProjects: GameState.completedProjects,
      transactions: GameState.transactions.slice(-MAX_SAVED_TRANSACTIONS),
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(dataToSave));
    console.log("Game Saved !");
  }

  static load(): boolean {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return false;

    try {
      const data = JSON.parse(saved);
      GameState.money = data.money;
      GameState.reputation = data.reputation;
      GameState.day = data.day;
      GameState.timeOfDay = data.timeOfDay;
      GameState.officeLevel = data.officeLevel;
      GameState.deskCount = data.deskCount;
      GameState.employeesCount = data.employeesCount;
      GameState.playerPos = data.playerPos;
      GameState.level = data.level;
      GameState.xp = data.xp;
      GameState.xpToNextLevel = data.xpToNextLevel;
      GameState.needs = data.needs;
      GameState.openedWindows = data.openedWindows || [];
      GameState.availableCandidates = data.availableCandidates || [];
      GameState.availableContracts = data.availableContracts || [];
      GameState.purchasedPoles = data.purchasedPoles || [];
      GameState.officeDirt = data.officeDirt || 0;
      GameState.fridgeDirt = data.fridgeDirt || 0;
      GameState.hasDoubleScreens = data.hasDoubleScreens || false;
      GameState.hasTrashCans = data.hasTrashCans || false;
      GameState.hasPremiumCoffee = data.hasPremiumCoffee || false;
      GameState.hasAssistant = data.hasAssistant || false;
      GameState.hasOperationsDirector = data.hasOperationsDirector || false;
      GameState.hasSalesDirector = data.hasSalesDirector || false;
      GameState.hasReadBookToday = data.hasReadBookToday || false;
      GameState.hasCleaner = data.hasCleaner || false;
      GameState.completedProjects = data.completedProjects || [];
      GameState.transactions = data.transactions || [];

      // Recréation des entités ECS employés (perdues lors du reload de page)
      GameState.employeesInfo.clear();
      const stableStates = ['working', 'off_duty'];
      for (const saved of (data.employees || [])) {
        const eid = addEntity(world);
        addComponent(world, Employee, eid);
        Employee.frontendSkill[eid] = saved.frontendSkill ?? 1;
        Employee.backendSkill[eid] = saved.backendSkill ?? 1;
        Employee.designSkill[eid] = saved.designSkill ?? 1;
        Employee.energy[eid] = 100;
        Employee.isWorking[eid] = 1;

        const { frontendSkill, backendSkill, designSkill, ...info } = saved;
        GameState.employeesInfo.set(eid, {
          ...info,
          state: stableStates.includes(info.state) ? info.state : 'off_duty',
          actionTimer: 0,
        });
      }
      GameState.isToiletOccupied = false;

      // Recréation des entités ECS projets en cours
      GameState.projectInfos.clear();
      for (const saved of (data.projects || [])) {
        const eid = addEntity(world);
        addComponent(world, Project, eid);
        Project.id[eid] = eid;
        Project.budget[eid] = saved.budget;
        Project.totalFrontend[eid] = saved.totalFrontend;
        Project.totalBackend[eid] = saved.totalBackend;
        Project.totalDesign[eid] = saved.totalDesign;
        Project.progressFrontend[eid] = saved.progressFrontend;
        Project.progressBackend[eid] = saved.progressBackend;
        Project.progressDesign[eid] = saved.progressDesign;
        Project.isCompleted[eid] = 0;

        GameState.projectInfos.set(eid, {
          title: saved.title,
          budget: saved.budget,
          deadlineDay: saved.deadlineDay,
        });
      }

      if (GameState.availableCandidates.length === 0) {
        GameState.generateCandidates();
      }
      
      if (GameState.availableContracts.length === 0) {
        import('../core/EventBus').then(m => m.EventBus.emit('REQUEST_CONTRACTS'));
      }
      
      // Update UI components
      EventBus.emit('MONEY_CHANGED', GameState.money);
      EventBus.emit('TIME_TICK', { day: GameState.day, time: GameState.timeOfDay });
      EventBus.emit('XP_CHANGED', GameState.xp);
      EventBus.emit('NEEDS_CHANGED');
      
      return true;
    } catch (e) {
      console.error("Failed to load save file", e);
      return false;
    }
  }

  static hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }
  
  static clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }
}