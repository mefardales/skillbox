/* ═══════════════════════════════════════════════════════════════
   Skillbox — Global Application State
   ═══════════════════════════════════════════════════════════════ */

const state = {
  // Data
  registry: { skills: [] },
  projects: [],
  teams: [],
  history: [],
  tasks: [],
  messages: [],

  // UI state
  activeView: 'dashboard',
  activeCategory: '',
  activeProjectPath: null,
  activeSkillId: null,
  currentEnvName: 'DEV',
  editingTeamId: null,
  teamMembers: [],
  editingSkillId: null,
  editingTaskId: null,

  // Terminal state
  terminals: [],
  activeTerminalId: null,
  terminalPanelOpen: false,
  splitTerminalIds: [],
  focusedTerminalId: null,

  // Panel state
  projectSidebarOpen: true,
  rightPanelOpen: true,
  activeRightTab: 'tasks',
};

export default state;
