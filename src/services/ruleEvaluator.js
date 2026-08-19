/**
 * Rule Evaluation Engine for Systematic Literature Review (SLR)
 * Provides declarative predicates for:
 * - Data Quality & Missing Fields
 * - Exclusion Criteria (EC1-EC5 & Custom)
 * - PICO Framework Non-Compliance
 * - AI Verdict & Confidence Segmentation
 * - Compound Multi-Condition Rules
 */

// Evaluate a single condition against a paper
export function evaluateCondition(paper, condition) {
  if (!paper || !condition) return false;
  const { field, operator, value } = condition;
  const rawVal = paper[field];

  switch (operator) {
    case 'is_empty':
      return rawVal === undefined || rawVal === null || String(rawVal).trim() === '' || rawVal === 'N/A';

    case 'is_not_empty':
      return rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '' && rawVal !== 'N/A';

    case 'contains':
      if (rawVal === undefined || rawVal === null) return false;
      return String(rawVal).toLowerCase().includes(String(value || '').toLowerCase());

    case 'not_contains':
      if (rawVal === undefined || rawVal === null) return true;
      return !String(rawVal).toLowerCase().includes(String(value || '').toLowerCase());

    case 'starts_with':
      if (rawVal === undefined || rawVal === null) return false;
      return String(rawVal).toLowerCase().startsWith(String(value || '').toLowerCase());

    case 'equals':
      if (rawVal === undefined || rawVal === null) return false;
      return String(rawVal).toLowerCase() === String(value || '').toLowerCase();

    case 'regex':
      if (rawVal === undefined || rawVal === null) return false;
      try {
        const re = new RegExp(value, 'i');
        return re.test(String(rawVal));
      } catch {
        return false;
      }

    case 'lt':
      const numValLt = parseFloat(rawVal);
      const numTargetLt = parseFloat(value);
      return !isNaN(numValLt) && !isNaN(numTargetLt) && numValLt < numTargetLt;

    case 'gt':
      const numValGt = parseFloat(rawVal);
      const numTargetGt = parseFloat(value);
      return !isNaN(numValGt) && !isNaN(numTargetGt) && numValGt > numTargetGt;

    default:
      return false;
  }
}

// Evaluate compound conditions (AND / OR)
export function evaluateCompoundRule(paper, conditions = [], matchMode = 'AND') {
  if (!conditions || conditions.length === 0) return true;
  if (matchMode === 'OR') {
    return conditions.some(cond => evaluateCondition(paper, cond));
  }
  return conditions.every(cond => evaluateCondition(paper, cond));
}

// Built-in Smart Preset Rule Definitions
export function getBuiltInPresets(ecList = []) {
  return [
    // Category: Data Quality
    {
      id: 'missing_abstract',
      category: 'Data Quality',
      icon: 'FileText',
      label: 'Missing / Incomplete Abstract',
      description: 'Papers where abstract is empty, N/A, or less than 25 characters',
      defaultEcReason: ecList[4] || 'EC5: Non-accessible literature / Missing full text or abstract',
      predicate: (p) => !p.abstract || p.abstract === 'N/A' || p.abstract.trim().length < 25
    },
    {
      id: 'missing_doi',
      category: 'Data Quality',
      icon: 'Link',
      label: 'Missing DOI / Canonical Link',
      description: 'Papers lacking a valid Digital Object Identifier and direct URL',
      defaultEcReason: ecList[4] || 'EC5: Inaccessible publication record',
      predicate: (p) => (!p.doi || p.doi === 'N/A') && (!p.url || p.url === 'N/A')
    },
    {
      id: 'missing_year',
      category: 'Data Quality',
      icon: 'Calendar',
      label: 'Missing Publication Year',
      description: 'Papers without publication year or year older than 2020',
      defaultEcReason: 'EC: Publication year before protocol threshold (pre-2020)',
      predicate: (p) => !p.year || isNaN(p.year) || p.year < 2020
    },
    {
      id: 'missing_venue',
      category: 'Data Quality',
      icon: 'Building',
      label: 'Missing Journal / Venue',
      description: 'Papers with unknown or unverified publication venue',
      defaultEcReason: 'EC5: Unindexed / Informal preprint without academic peer review venue',
      predicate: (p) => !p.venue || p.venue === 'N/A' || p.venue.trim().length < 3
    },

    // Category: Exclusion Criteria (EC)
    {
      id: 'violates_ec1',
      category: 'Exclusion Criteria (EC)',
      icon: 'ShieldAlert',
      label: 'Violates EC1: Malware / Hash URLs Only',
      description: 'Studies solely analyzing binary hash/URL signatures without semantic NLP',
      defaultEcReason: ecList[0] || 'EC1: Studies focusing solely on malware analysis, or pure URL identification via hash algorithms without semantic text analysis.',
      predicate: (p) => {
        const text = `${p.title || ''} ${p.abstract || ''} ${p.ai_rationale || ''} ${p.exclusion_reason || ''}`.toLowerCase();
        return text.includes('ec1') || (text.includes('malware') && !text.includes('phishing') && !text.includes('smishing')) || text.includes('hash algorithm') || text.includes('binary signature');
      }
    },
    {
      id: 'violates_ec2',
      category: 'Exclusion Criteria (EC)',
      icon: 'VolumeX',
      label: 'Violates EC2: Voice / Audio Scam Calls',
      description: 'Studies focusing on audio telephony or voice biometrics rather than text messages',
      defaultEcReason: ecList[1] || 'EC2: Studies targeting voice call fraud (vishing) or network-layer telecom spoofing without message text analysis.',
      predicate: (p) => {
        const text = `${p.title || ''} ${p.abstract || ''} ${p.ai_rationale || ''} ${p.exclusion_reason || ''}`.toLowerCase();
        return text.includes('ec2') || text.includes('vishing') || text.includes('voice call') || text.includes('audio signal') || text.includes('telephony voice');
      }
    },
    {
      id: 'violates_ec3',
      category: 'Exclusion Criteria (EC)',
      icon: 'Cpu',
      label: 'Violates EC3: No ML / No LLM Baseline',
      description: 'Studies using only static blacklist heuristics without Machine Learning or Pretrained Language Models',
      defaultEcReason: ecList[2] || 'EC3: Traditional rule-based or heuristic keyword matching systems lacking ML/PLM/LLM baselines or evaluation.',
      predicate: (p) => {
        const text = `${p.title || ''} ${p.abstract || ''} ${p.ai_rationale || ''} ${p.exclusion_reason || ''}`.toLowerCase();
        return text.includes('ec3') || text.includes('heuristic-only') || text.includes('static blacklist') || (text.includes('rule-based') && !text.includes('bert') && !text.includes('llm') && !text.includes('learning'));
      }
    },
    {
      id: 'violates_ec4',
      category: 'Exclusion Criteria (EC)',
      icon: 'DatabaseZap',
      label: 'Violates EC4: Pure Theory / No Dataset',
      description: 'Papers without empirical datasets, quantitative evaluation, or validation samples',
      defaultEcReason: ecList[3] || 'EC4: Position papers, survey proposals, or theoretical frameworks without empirical validation datasets or metrics.',
      predicate: (p) => {
        const text = `${p.title || ''} ${p.abstract || ''} ${p.ai_rationale || ''} ${p.exclusion_reason || ''}`.toLowerCase();
        return text.includes('ec4') || text.includes('no dataset') || text.includes('purely theoretical') || text.includes('position paper') || (p.sample_size_n === 'N/A' && p.status === 'EXCLUDED');
      }
    },
    {
      id: 'violates_ec5',
      category: 'Exclusion Criteria (EC)',
      icon: 'Globe',
      label: 'Violates EC5: Non-English / Inaccessible',
      description: 'Non-English papers or literature with unavailable full-text',
      defaultEcReason: ecList[4] || 'EC5: Full-text unavailable through academic indexes, or published in languages other than English/Vietnamese.',
      predicate: (p) => {
        const text = `${p.title || ''} ${p.abstract || ''} ${p.ai_rationale || ''} ${p.exclusion_reason || ''}`.toLowerCase();
        return text.includes('ec5') || text.includes('non-english') || text.includes('inaccessible');
      }
    },

    // Category: PICO Framework Non-Compliance
    {
      id: 'pico_population_mismatch',
      category: 'PICO Framework',
      icon: 'Target',
      label: 'PICO Population Mismatch',
      description: 'Studies outside SMS/Email/Chat scam text domains (e.g. image spoofing, hardware IoT)',
      defaultEcReason: 'PICO: Population mismatch - does not evaluate textual scam/phishing messages',
      predicate: (p) => {
        const text = `${p.title || ''} ${p.abstract || ''}`.toLowerCase();
        const hasScam = text.includes('phish') || text.includes('smish') || text.includes('scam') || text.includes('fraud') || text.includes('spam') || text.includes('social engineering');
        return !hasScam;
      }
    },
    {
      id: 'pico_intervention_mismatch',
      category: 'PICO Framework',
      icon: 'Sparkles',
      label: 'PICO Intervention Mismatch',
      description: 'Studies lacking Pretrained Language Models, PhoBERT, or LLM Prompting architectures',
      defaultEcReason: 'PICO: Intervention mismatch - no LLM, PLM, or transformer evaluation',
      predicate: (p) => {
        const text = `${p.title || ''} ${p.abstract || ''}`.toLowerCase();
        const hasModel = text.includes('bert') || text.includes('llm') || text.includes('language model') || text.includes('gpt') || text.includes('transformer') || text.includes('prompt') || text.includes('few-shot');
        return !hasModel;
      }
    },

    // Category: AI Verdict & Confidence
    {
      id: 'ai_rejected',
      category: 'AI Screening',
      icon: 'XCircle',
      label: 'AI Verdict: EXCLUDED',
      description: 'All papers where Gemini AI screening recommended Exclusion',
      defaultEcReason: 'AI Screening recommendation: EXCLUDED',
      predicate: (p) => p.ai_decision === 'EXCLUDED'
    },
    {
      id: 'ai_uncertain',
      category: 'AI Screening',
      icon: 'HelpCircle',
      label: 'AI Uncertainty / Low Confidence (<75%)',
      description: 'Papers where AI is UNSURE or confidence score is below 75%',
      defaultEcReason: 'AI Screening: Low confidence / flagged for manual expert verification',
      predicate: (p) => p.ai_decision === 'UNSURE' || (p.ai_confidence !== undefined && p.ai_confidence !== null && p.ai_confidence < 0.75)
    },
    {
      id: 'unscreened_pending',
      category: 'AI Screening',
      icon: 'Clock',
      label: 'Unscreened Literature (Pending + No AI)',
      description: 'Papers in PENDING status that have not been evaluated by AI',
      defaultEcReason: null,
      predicate: (p) => p.status === 'PENDING' && !p.ai_decision
    }
  ];
}

// Find matching paper IDs given a preset ID or custom compound rule
export function filterPapersByRule(papers = [], ruleOrPresetId, ecList = [], customRule = null) {
  if (!papers || papers.length === 0) return [];

  // If custom rule provided
  if (customRule && customRule.conditions) {
    return papers
      .filter(p => evaluateCompoundRule(p, customRule.conditions, customRule.matchMode || 'AND'))
      .map(p => p.id);
  }

  // Built-in presets
  const presets = getBuiltInPresets(ecList);
  const matchedPreset = presets.find(pr => pr.id === ruleOrPresetId);
  if (matchedPreset) {
    return papers.filter(matchedPreset.predicate).map(p => p.id);
  }

  return [];
}
