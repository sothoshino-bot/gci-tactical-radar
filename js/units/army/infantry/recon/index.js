export const RECON_SQUAD_DATA = {
    id: "SPECIAL_FORCES_RECON",
    name: "長距離偵察部隊 (LRRP / Special Forces)",
    branch: "army",
    category: "RECON",
    speed: { maxSpeed: 0.3 },
    engagementRange: 0.5,
    payload: { personnel: 12, stealth: true },
    tasks: ["RECON", "INFILTRATION", "DESIGNATE_TARGET"],
    behavior: "stealth_recon"
};