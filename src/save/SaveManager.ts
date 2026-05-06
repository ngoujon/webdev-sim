import { GameState } from '../sim/gameState';
import { EventBus } from '../core/EventBus';

const SAVE_KEY = 'webdev_tycoon_save';

export class SaveManager {
  static save() {
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