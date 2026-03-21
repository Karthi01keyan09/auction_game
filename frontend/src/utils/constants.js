export const teamsList = [
  { id: 'csk', name: 'CSK', color: '#F9CD05', logo: 'https://upload.wikimedia.org/wikipedia/en/2/2b/Chennai_Super_Kings_Logo.svg' },
  { id: 'mi', name: 'MI', color: '#004BA0', logo: 'https://upload.wikimedia.org/wikipedia/en/c/cd/Mumbai_Indians_Logo.svg' },
  { id: 'rcb', name: 'RCB', color: '#E30613', logo: 'https://upload.wikimedia.org/wikipedia/en/6/62/Royal_Challengers_Bengaluru_logo.svg' },
  { id: 'kkr', name: 'KKR', color: '#3A225D', logo: 'https://upload.wikimedia.org/wikipedia/en/4/4c/Kolkata_Knight_Riders_Logo.svg' },
  { id: 'srh', name: 'SRH', color: '#F26522', logo: 'https://upload.wikimedia.org/wikipedia/en/8/81/Sunrisers_Hyderabad.svg' },
  { id: 'dc', name: 'DC', color: '#00008B', logo: 'https://upload.wikimedia.org/wikipedia/en/2/2f/Delhi_Capitals.svg' },
  { id: 'rr', name: 'RR', color: '#EA1A85', logo: 'https://upload.wikimedia.org/wikipedia/en/6/60/Rajasthan_Royals_Logo.svg' },
  { id: 'pbks', name: 'PBKS', color: '#D71920', logo: 'https://upload.wikimedia.org/wikipedia/en/d/d4/Punjab_Kings_Logo.svg' },
  { id: 'lsg', name: 'LSG', color: '#0057E2', logo: 'https://upload.wikimedia.org/wikipedia/en/a/a9/Lucknow_Super_Giants_IPL_Logo.svg' },
  { id: 'gt', name: 'GT', color: '#1B2133', logo: 'https://upload.wikimedia.org/wikipedia/en/0/09/Gujarat_Titans_Logo.svg' }
];

export const getTeamById = (id) => teamsList.find(t => t.id === id);
