export interface ContractTemplate {
  id: string;
  title: string;
  budget: number;
  difficulty: number;
  requiredTasks: {
    frontend: number;
    backend: number;
    design: number;
  };
  deadlineDays?: number;
}

const RESTAURANT_NAMES = ["Le Gourmet", "Pizza Express", "Sushi Bella", "L'Atelier Culinaire", "Burger & Co", "Pasta Roma", "Le Petit Bistrot", "Saveurs d'Asie"];
const BRAND_NAMES = ["TechCorp", "WebSolutions", "InnoDesign", "NextGen", "SmartSoft", "EcoLogic", "GlobalNet", "CreativeStudio"];
const PHOTOGRAPHER_NAMES = ["Jean Dupont", "Alice Martin", "Studio Reflex", "Focus Pro", "Lumière & Ombre", "Marc Photographie"];
const ECOMMERCE_NAMES = ["Sneakers Shop", "Tech Store", "Bio Cosmétiques", "Mode & Co", "Gaming Gear", "Deco Maison"];

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'landing_page_1',
    title: 'Landing Page pour Restaurant',
    budget: 300,
    difficulty: 1,
    requiredTasks: { frontend: 50, backend: 0, design: 20 }
  },
  {
    id: 'bugfix_wp',
    title: 'Bugfix WordPress Urgent',
    budget: 150,
    difficulty: 1,
    requiredTasks: { frontend: 10, backend: 30, design: 0 }
  },
  {
    id: 'portfolio_dev',
    title: 'Portfolio pour Photographe',
    budget: 500,
    difficulty: 2,
    requiredTasks: { frontend: 80, backend: 0, design: 60 }
  },
  {
    id: 'ecommerce_simple',
    title: 'Boutique en ligne',
    budget: 1500,
    difficulty: 3,
    requiredTasks: { frontend: 100, backend: 150, design: 50 }
  }
];

function getRandomElement(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getRandomContracts(count: number, budgetMultiplier: number = 1): ContractTemplate[] {
  const shuffled = [...CONTRACT_TEMPLATES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(c => {
    let newTitle = c.title;
    if (c.id === 'landing_page_1') newTitle = `Landing Page pour ${getRandomElement(RESTAURANT_NAMES)}`;
    else if (c.id === 'bugfix_wp') newTitle = `Bugfix WP pour ${getRandomElement(BRAND_NAMES)}`;
    else if (c.id === 'portfolio_dev') newTitle = `Portfolio pour ${getRandomElement(PHOTOGRAPHER_NAMES)}`;
    else if (c.id === 'ecommerce_simple') newTitle = `Boutique E-commerce - ${getRandomElement(ECOMMERCE_NAMES)}`;

    const deadlineDays = 3 + Math.floor(Math.random() * 5); // 3 to 7 days
    
    return {
      ...c,
      id: c.id + '_' + Date.now() + Math.floor(Math.random()*1000), // Make ID unique
      title: newTitle,
      budget: Math.floor(c.budget * budgetMultiplier),
      deadlineDays
    };
  });
}
