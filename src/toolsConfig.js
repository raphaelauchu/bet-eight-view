// ===================== Config du mega menu "Outils" =====================
// Liste UNIQUEMENT ce qui existe reellement dans l'app (lu dans src/Analyses.js, Dashboard.js,
// Modeles.js, Pool.js) + deux outils explicitement marques "bientot" (aucun autre). target :
// { type: 'anchor', id } scrolle une section de l'accueil ; { type: 'path', path } ouvre une
// page publique dediee (voir src/SimplePage.js / src/PoolShowcase.js).
export const TOOL_GROUPS = [
  {
    id: 'analyse',
    titleKey: 'tools_group_analysis',
    items: [
      { id: 'analyses', titleKey: 'tools_item_analyses_title', descKey: 'tools_item_analyses_desc', status: 'available', target: { type: 'anchor', id: 'analyses' } },
      { id: 'stats-joueurs', titleKey: 'tools_item_playerstats_title', descKey: 'tools_item_playerstats_desc', status: 'available', target: { type: 'path', path: '/outils/stats-joueurs' } },
      { id: 'modeles', titleKey: 'tools_item_models_title', descKey: 'tools_item_models_desc', status: 'available', target: { type: 'path', path: '/outils/modeles' } },
    ],
  },
  {
    id: 'gestion',
    titleKey: 'tools_group_management',
    items: [
      { id: 'bankroll', titleKey: 'tools_item_bankroll_title', descKey: 'tools_item_bankroll_desc', status: 'available', target: { type: 'anchor', id: 'bankroll' } },
      { id: 'watchlist', titleKey: 'tools_item_watchlist_title', descKey: 'tools_item_watchlist_desc', status: 'available', target: { type: 'path', path: '/outils/watchlist' } },
    ],
  },
  {
    id: 'pool',
    titleKey: 'tools_group_pool',
    items: [
      { id: 'pool-hockey', titleKey: 'tools_item_pool_title', descKey: 'tools_item_pool_desc', status: 'available', target: { type: 'path', path: '/pool' } },
    ],
  },
  {
    id: 'bientot',
    titleKey: 'tools_group_soon',
    items: [
      { id: 'comparateur-cotes', titleKey: 'tools_item_oddscompare_title', descKey: 'tools_item_oddscompare_desc', status: 'soon', target: { type: 'path', path: '/outils/comparateur-cotes' } },
      { id: 'plus-ev', titleKey: 'tools_item_plusev_title', descKey: 'tools_item_plusev_desc', status: 'soon', target: { type: 'path', path: '/outils/plus-ev' } },
    ],
  },
];

export const ALL_TOOLS = TOOL_GROUPS.flatMap(g => g.items);

export function findTool(id) {
  return ALL_TOOLS.find(t => t.id === id) || null;
}
