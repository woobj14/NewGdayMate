import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

// ── WordCard ──────────────────────────────────────────────
export interface WordData {
  word: string; phonetic: string; pos: string;
  ko: string; def: string; syn: string;
  status?: '외움' | '햇갈림' | '모름';
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  '외움':   { bg: Colors.greenBg, text: Colors.greenDk },
  '햇갈림': { bg: Colors.amberBg, text: Colors.amberDk },
  '모름':   { bg: Colors.redBg,   text: Colors.redDk },
};

interface WordCardProps {
  word: WordData;
  showDef?: boolean;
  onFlip?: () => void;
  onRate?: (r: 0|1|2|3) => void;
}

export function WordCard({ word, showDef = false, onFlip, onRate }: WordCardProps) {
  const sc = word.status ? STATUS_COLOR[word.status] : null;
  return (
    <Pressable style={wc.card} onPress={onFlip}>
      {sc && (
        <View style={[wc.statusTag, { backgroundColor: sc.bg }]}>
          <Text style={[Typography.label3, { color: sc.text }]}>{word.status}</Text>
        </View>
      )}
      <Text style={[Typography.h1, { textAlign:'center', marginBottom:8, letterSpacing:-1.5 }]}>{word.word}</Text>
      <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', marginBottom:16 }]}>
        {word.phonetic}  {word.pos}
      </Text>
      {showDef ? (
        <>
          <View style={wc.divider} />
          <Text style={[Typography.body3, { textAlign:'center', color:Colors.ink, marginTop:16, lineHeight:22 }]}>
            {word.def}
          </Text>
          <Text style={[Typography.label2, { textAlign:'center', color:Colors.brand, marginTop:8 }]}>
            {word.ko}
          </Text>
          {word.syn && (
            <Text style={[Typography.label2, { textAlign:'center', color:Colors.ink3, marginTop:5 }]}>
              syn. {word.syn}
            </Text>
          )}
          {onRate && (
            <View style={wc.rateRow}>
              {([{ r:0, lbl:'모름', bg:Colors.redBg, text:Colors.red },
                 { r:1, lbl:'어려움', bg:Colors.amberBg, text:Colors.amberDk },
                 { r:2, lbl:'보통', bg:Colors.brandBg, text:Colors.brand },
                 { r:3, lbl:'쉬움', bg:Colors.greenBg, text:Colors.greenDk }] as const).map(btn => (
                <Pressable key={btn.r} onPress={() => onRate(btn.r)}
                  style={[wc.rateBtn, { backgroundColor:btn.bg }]}>
                  <Text style={[Typography.label2, { color:btn.text }]}>{btn.lbl}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : (
        <Text style={[Typography.label2, { color:Colors.ink3, textAlign:'center' }]}>탭해서 뜻 보기</Text>
      )}
    </Pressable>
  );
}

const wc = StyleSheet.create({
  card:      { backgroundColor:Colors.white, borderRadius:24, borderWidth:1, borderColor:Colors.line, padding:28, alignItems:'center', position:'relative' },
  statusTag: { position:'absolute', top:14, right:14, paddingHorizontal:10, paddingVertical:3, borderRadius:99 },
  divider:   { width:40, height:2, backgroundColor:Colors.line, borderRadius:99 },
  rateRow:   { flexDirection:'row', gap:8, marginTop:20 },
  rateBtn:   { flex:1, paddingVertical:9, borderRadius:10, alignItems:'center' },
});

// ── StreamingText ──────────────────────────────────────────────
interface StreamingTextProps {
  text: string; streaming?: boolean;
  style?: object;
}

export function StreamingText({ text, streaming = false, style }: StreamingTextProps) {
  return (
    <Text style={[Typography.body3, { color:Colors.ink, lineHeight:20 }, style]}>
      {text}
      {streaming && <Text style={{ color:Colors.brand }}>▌</Text>}
    </Text>
  );
}

// ── QuizCard ──────────────────────────────────────────────
interface QuizCardProps {
  question: string; choices: string[];
  selected: number | null; answered: boolean; correct: number;
  onSelect: (i: number) => void;
}

export function QuizCard({ question, choices, selected, answered, correct, onSelect }: QuizCardProps) {
  return (
    <View style={qc.wrap}>
      <Text style={[Typography.bold2, { color:Colors.ink, marginBottom:16, lineHeight:22 }]}>{question}</Text>
      {choices.map((ch, i) => {
        let bg: string = Colors.bg, border: string = Colors.line;
        if (answered) {
          if (i === correct)                      { bg = Colors.greenBg; border = '#86efac'; }
          else if (i === selected && i !== correct){ bg = Colors.redBg;   border = '#fca5a5'; }
        } else if (selected === i) {
          bg = Colors.brandBg; border = Colors.brand;
        }
        return (
          <Pressable key={i} onPress={() => !answered && onSelect(i)}
            style={[qc.choice, { backgroundColor:bg, borderColor:border }]}>
            <View style={[qc.num, {
              backgroundColor: answered && i===correct ? Colors.green : answered && i===selected ? Colors.red : selected===i ? Colors.brand : Colors.bg,
            }]}>
              <Text style={[Typography.label2, { color: (answered&&(i===correct||i===selected))||selected===i ? '#fff' : Colors.ink3 }]}>
                {['①','②','③','④'][i]}
              </Text>
            </View>
            <Text style={[Typography.body3, { flex:1, color:Colors.ink }]}>{ch}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const qc = StyleSheet.create({
  wrap:   { backgroundColor:Colors.white, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:16 },
  choice: { flexDirection:'row', alignItems:'flex-start', gap:12, borderRadius:13, borderWidth:1.5, padding:13, marginBottom:9 },
  num:    { width:24, height:24, borderRadius:7, alignItems:'center', justifyContent:'center' },
});
