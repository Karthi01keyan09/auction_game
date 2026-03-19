export const teamsList = [
  { id: 'csk', name: 'CSK', color: '#F9CD05', logo: 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/CSK/Logos/Logooutline/CSKoutline.png' },
  { id: 'mi', name: 'MI', color: '#004BA0', logo: 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/MI/Logos/Logooutline/MIoutline.png' },
  { id: 'rcb', name: 'RCB', color: '#E30613', logo: 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/RCB/Logos/Logooutline/RCBoutline.png' },
  { id: 'kkr', name: 'KKR', color: '#3A225D', logo: 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/KKR/Logos/Logooutline/KKRoutline.png' },
  { id: 'srh', name: 'SRH', color: '#F26522', logo: 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/SRH/Logos/Logooutline/SRHoutline.png' },
  { id: 'dc', name: 'DC', color: '#00008B', logo: 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/DC/Logos/Logooutline/DCoutline.png' },
  { id: 'rr', name: 'RR', color: '#EA1A85', logo: 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/RR/Logos/Logooutline/RRoutline.png' },
  { id: 'pbks', name: 'PBKS', color: '#D71920', logo: 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/PBKS/Logos/Logooutline/PBKSoutline.png' },
  { id: 'lsg', name: 'LSG', color: '#0057E2', logo: 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/LSG/Logos/Logooutline/LSGoutline.png' },
  { id: 'gt', name: 'GT', color: '#1B2133', logo: 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/GT/Logos/Logooutline/GToutline.png' }
];

export const getTeamById = (id) => teamsList.find(t => t.id === id);
