export const SCHOOL = 'የደብረ ጽዮን ሰላም አርጊው ቅድስት ማርያም ሰ/ት/ቤት';
export const SCHOOL_SHORT = 'ደ/ጽ ቅድስት ማርያም ሰ/ት/ቤት';
export const FORM_TITLE = 'የመዘምራን መቆጣጠሪያ ቅጽ';

export const STATUSES = ['present', 'absent', 'late', 'excused'];
export const STATUS = {
  present: { label: 'ተገኝቷል', short: 'ተገኝ', mark: '✓' },
  absent: { label: 'ቀሪ', short: 'ቀሪ', mark: '✗' },
  late: { label: 'አርፍዷል', short: 'አርፍዷል', mark: 'ዘ' },
  excused: { label: 'በፈቃድ', short: 'ፈቃድ', mark: 'ፈ' },
};

export const GENDER = { M: 'ወ', F: 'ሴ' };
export const GENDER_LONG = { M: 'ወንድ', F: 'ሴት' };

export const attendancePct = (present = 0, late = 0, sessions = 0) =>
  sessions ? Math.round(((present + late) / sessions) * 100) : null;

export const pctTone = (p) => (p === null ? 'muted' : p >= 75 ? 'good' : p >= 50 ? 'mid' : 'low');

// First letter of the name, skipping the "ዲ/ን" (deacon) title.
export const initial = (name) => name.replace(/^(ዲ\/ን|ቀሲስ|መ\/ር)\s*/, '').trim().charAt(0);
