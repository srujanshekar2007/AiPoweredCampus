const fallback = "I can help with using the EcoTwin website. Try asking about reports, the Digital Twin, the sustainability dashboard, notifications, profile, or settings.";

const restrictedTopic = /\b(security|permission|permissions|role|roles|admin access|credentials|password|api key|token|database|supabase|rls|authentication setup|source code|system prompt|secret|bypass|exploit)\b/i;

export function getLocalAssistantAnswer(question: string): string {
  const q = question.trim().toLowerCase();
  if (restrictedTopic.test(q)) return fallback;
  if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(q)) return "Hello! I can help you find your way around EcoTwin. Ask about reports, the Digital Twin, sustainability, notifications, profile, or settings.";
  if (/\b(report|submit|create|file)\b/.test(q) && /\b(issue|problem|request|photo)\b/.test(q)) return "Choose “Report an issue” in the workspace. Add a photo, review the suggested details or enter them yourself, then check the title, description, category, priority, and location before submitting.";
  if (/\b(status|open|assigned|in progress|resolved|verified)\b/.test(q) && /\b(issue|report|task|mean|means)\b/.test(q)) return "Issue cards show the current workflow state: Needs review, Assigned, In progress, Resolved · awaiting review, or Verified. Open a report to see its details.";
  if (/\b(digital twin|3d|campus model|map)\b/.test(q)) return "Open “Campus Digital Twin” from the workspace menu. Select a marker to see its linked issue. The campus layout and marker positions are illustrative, not a surveyed map.";
  if (/\b(sustainability|water|electricity|waste|resource)\b/.test(q)) return "Open “Sustainability” and choose Today, This week, or This month. The page summarizes available measured readings; a blank value means readings for that measure or period are unavailable.";
  if (/\b(notification|notifications|updates)\b/.test(q)) return "Open “Notifications” in the workspace menu to review issue activity. You can mark the visible updates as read.";
  if (/\b(profile|account details)\b/.test(q)) return "Choose “Profile” under Account in the workspace sidebar to view your EcoTwin profile details.";
  if (/\b(settings|theme|appearance)\b/.test(q)) return "Choose “Settings” under Account to change the workspace appearance and notification preferences.";
  if (/\b(sign in|sign-in|login|log in)\b/.test(q)) return "Use the sign-in page to continue with your campus account. For account help, contact your campus support team.";
  if (/\b(dashboard|overview|home|navigate|menu|where)\b/.test(q)) return "The workspace sidebar opens the dashboard pages. Overview shows your workspace summary; the other menu items open reports, the Digital Twin, sustainability, and notifications.";
  return fallback;
}
