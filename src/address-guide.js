// Only repeat fragments explicitly present in the dataset address.
export function addressGuide(address) {
  const parts = String(address || "").split(/[،,]/).map((part) => part.trim()).filter(Boolean);
  const find = (pattern) => parts.find((part) => pattern.test(part)) || null;
  const building = find(/پاساژ|مجتمع(?:\s+تجاری)?|بازار(?:\s+موبایل)?|مرکز خرید|مال(?:\s|$)/);
  const floor = find(/طبقه|همکف|زیرزمین/);
  const unit = find(/(?:^|\s)(?:واحد|پلاک|غرفه)\s*[۰-۹٠-٩0-9]/);
  if (!building && !floor) return null;
  return { building, floor, unit };
}
