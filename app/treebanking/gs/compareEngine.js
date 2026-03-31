function emptyBucket() {
  return { total: 0, right: 0, wrong: 0, almost: 0, unique: 0 };
}

function makeEmptyReport() {
  return {
    sentences: emptyBucket(),
    words: emptyBucket(),
    heads: emptyBucket(),
    relations: emptyBucket(),
    lemmata: emptyBucket(),
    postags: {
      ...emptyBucket(),
      datapoints: {
        total: 0,
        parts_of_speech: {},
        persons: {},
        numbers: {},
        tenses: {},
        moods: {},
        voices: {},
        genders: {},
        cases: {},
        degrees: {}
      }
    }
  };
}

function ensureSubBucket(map, key) {
  if (!map[key]) map[key] = emptyBucket();
  return map[key];
}

function norm(v) {
  return String(v ?? '').trim();
}

function isElliptic(word) {
  return String(word?.elliptic || '').toLowerCase() === 'true';
}

function wordMap(words = []) {
  const map = new Map();
  words.forEach(w => {
    if (!isElliptic(w)) map.set(String(w.id), w);
  });
  return map;
}

function sentenceMap(treebank = []) {
  const map = new Map();
  treebank.forEach(s => map.set(String(s.id), s));
  return map;
}

function postagSlots(tag = '') {
  const chars = norm(tag).padEnd(9, '-').slice(0, 9).split('');
  return {
    parts_of_speech: chars[0] || '-',
    persons: chars[1] || '-',
    numbers: chars[2] || '-',
    tenses: chars[3] || '-',
    moods: chars[4] || '-',
    voices: chars[5] || '-',
    genders: chars[6] || '-',
    cases: chars[7] || '-',
    degrees: chars[8] || '-'
  };
}

function bump(bucket, isRight) {
  bucket.total += 1;
  if (isRight) bucket.right += 1;
  else bucket.wrong += 1;
}

function bumpUnique(diffSet, bucket, key) {
  if (!diffSet.has(key)) {
    diffSet.add(key);
    bucket.unique += 1;
  }
}

function compareField(studentVal, goldVal) {
  return norm(studentVal) === norm(goldVal);
}

export function compareTreebanks(goldTreebank, reviewTreebank, compareOnly = ['head', 'relation', 'lemma', 'postag']) {
  const report = makeEmptyReport();
  const details = [];
  const uniqueDiffs = {
    words: new Set(),
    heads: new Set(),
    relations: new Set(),
    lemmata: new Set(),
    postags: new Set(),
    parts_of_speech: new Set(),
    persons: new Set(),
    numbers: new Set(),
    tenses: new Set(),
    moods: new Set(),
    voices: new Set(),
    genders: new Set(),
    cases: new Set(),
    degrees: new Set(),
    sentences: new Set()
  };

  const goldSentences = sentenceMap(goldTreebank);
  const reviewSentences = sentenceMap(reviewTreebank);

  const allSentenceIds = [...new Set([
    ...goldSentences.keys(),
    ...reviewSentences.keys()
  ])].sort((a, b) => Number(a) - Number(b));

  for (const sid of allSentenceIds) {
    const goldSentence = goldSentences.get(sid);
    const reviewSentence = reviewSentences.get(sid);

    report.sentences.total += 1;

    if (!goldSentence || !reviewSentence) {
      report.sentences.wrong += 1;
      bumpUnique(uniqueDiffs.sentences, report.sentences, sid);
      details.push({ sentenceId: sid, missing: true, words: [] });
      continue;
    }

    const goldWords = wordMap(goldSentence.words || []);
    const reviewWords = wordMap(reviewSentence.words || []);
    const allWordIds = [...new Set([
      ...goldWords.keys(),
      ...reviewWords.keys()
    ])].sort((a, b) => Number(a) - Number(b));

    let sentenceHasDiff = false;
    const sentenceDetails = [];

    for (const wid of allWordIds) {
      const g = goldWords.get(wid);
      const r = reviewWords.get(wid);

      report.words.total += 1;

        if (!g || !r) {
        report.words.wrong += 1;
        sentenceHasDiff = true;
        bumpUnique(uniqueDiffs.words, report.words, `missing:${wid}`);
        sentenceDetails.push({
            wordId: wid,
            missing: true,
            gold: g || null,
            review: r || null,
            diff: {}
        });
        continue;
        }

        const diff = {};
        let wordHasDiff = false;

        const item = {
        wordId: wid,
        form: g.form || r.form || '',
        gold: g,
        review: r,
        diff
        };

      if (compareOnly.includes('head')) {
        const ok = compareField(r.head, g.head);
        bump(report.heads, ok);
        if (!ok) {
          sentenceHasDiff = true;
          wordHasDiff = true;
          diff.head = { original: norm(g.head), new: norm(r.head) };
          bumpUnique(uniqueDiffs.heads, report.heads, `${norm(g.head)}=>${norm(r.head)}`);
        }
      }

      if (compareOnly.includes('relation')) {
        const ok = compareField(r.relation, g.relation);
        bump(report.relations, ok);
        if (!ok) {
          sentenceHasDiff = true;
          wordHasDiff = true;
          diff.relation = { original: norm(g.relation), new: norm(r.relation) };
          bumpUnique(uniqueDiffs.relations, report.relations, `${norm(g.relation)}=>${norm(r.relation)}`);
        }
      }

      if (compareOnly.includes('lemma')) {
        const ok = compareField(r.lemma, g.lemma);
        bump(report.lemmata, ok);
        if (!ok) {
          sentenceHasDiff = true;
          wordHasDiff = true;
          diff.lemma = { original: norm(g.lemma), new: norm(r.lemma) };
          bumpUnique(uniqueDiffs.lemmata, report.lemmata, `${norm(g.lemma)}=>${norm(r.lemma)}`);
        }
      }

      if (compareOnly.includes('postag')) {
        const ok = compareField(r.postag, g.postag);
        bump(report.postags, ok);

        const goldSlots = postagSlots(g.postag);
        const reviewSlots = postagSlots(r.postag);

        for (const [slotName, goldValue] of Object.entries(goldSlots)) {
          const reviewValue = reviewSlots[slotName];
          report.postags.datapoints.total += 1;

          const bucket = ensureSubBucket(report.postags.datapoints[slotName], goldValue);
          const slotOk = goldValue === reviewValue;
          bump(bucket, slotOk);

          if (!slotOk) {
            bumpUnique(
              uniqueDiffs[slotName],
              bucket,
              `${goldValue}=>${reviewValue}`
            );
          }
        }

        if (!ok) {
          sentenceHasDiff = true;
          wordHasDiff = true;
          diff.postag = { original: norm(g.postag), new: norm(r.postag) };
          bumpUnique(uniqueDiffs.postags, report.postags, `${norm(g.postag)}=>${norm(r.postag)}`);
        }
      }
        if (wordHasDiff) {
          report.words.wrong += 1;
          bumpUnique(uniqueDiffs.words, report.words, `missing:${sid}:${wid}`);
        } else {
          report.words.right += 1;
        }

      sentenceDetails.push(item);
    }

    if (sentenceHasDiff) {
      report.sentences.wrong += 1;
      bumpUnique(uniqueDiffs.sentences, report.sentences, sid);
    } else {
      report.sentences.right += 1;
    }

    details.push({
      sentenceId: sid,
      words: sentenceDetails
    });
  }

  return { report, details };
}