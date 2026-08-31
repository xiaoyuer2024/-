export type Counselor = {
  id: string
  name: string
  title: string
  focus: string
  years: string
}

export const TOPICS = [
  { id: 'intent', label: '他的心意' },
  { id: 'contact', label: '该不该联系' },
  { id: 'reunion', label: '复合可能' },
  { id: 'path', label: '关系走向' },
  { id: 'release', label: '我是否该放下' },
  { id: 'boundary', label: '暧昧与边界' },
] as const

export const COUNSELORS: Counselor[] = [
  { id: 'lin', name: '林晚', title: '关系动力学', focus: '拉扯、冷淡与复合窗口', years: '从业 8 年' },
  { id: 'shen', name: '沈予', title: '依恋与边界', focus: '自我价值、分离焦虑', years: '从业 11 年' },
  { id: 'gu', name: '顾衡', title: '沟通与决策', focus: '对话策略、止损节点', years: '从业 9 年' },
]

const READING: Record<string, string[]> = {
  intent: [
    '对方此刻的态度，更像「未关闭」而不是「已决定」。未关闭不等于承诺，它只说明关系还停在可观察的区间。',
    '你感受到的忽近忽远，通常不是谜题，而是对方把情绪成本转给你承担。先分清：哪些是信号，哪些只是你的等待。',
  ],
  contact: [
    '主动联系可以发生，但不要把它当成验证爱的实验。一次联系只负责把话说清，不负责让结果变好。',
    '若你发出去的信息需要对方来完成你的情绪闭环，这次联系多半会再次受伤。先写完你真正要说的那一句。',
  ],
  reunion: [
    '复合是否可能，不取决于念想有多深，而取决于冲突结构有没有被改写。旧剧本重演，不是重逢，是循环。',
    '真正可谈的复合，至少要有一件事被双方承认：当初为什么走不下去。没有这个承认，复合只是延期分离。',
  ],
  path: [
    '这段关系的走向，已经比你口头承认的更清楚。你一直在用「再等等」购买确定性，但确定性不会按等待计费。',
    '接下来 14 天，请只观察行为频率，不解释动机。动机可以编，频率很难装。',
  ],
  release: [
    '放下不是绝情，是停止用想象续约。你可以保留记忆，不必保留职位。',
    '当你开始问「该不该放下」，身体往往已经给出答案：继续耗着，比离开更痛。',
  ],
  boundary: [
    '暧昧最消耗人的地方，不是甜，是权责不清。你可以温柔，但要把可做与不可做说成句子，而不是气氛。',
    '边界一旦开口，关系会迅速分层：能尊重的人留下，靠模糊获利的人离开。这是筛选，不是损失。',
  ],
}

export function matchCounselor(topicId: string, question: string): Counselor {
  if (topicId === 'release' || topicId === 'boundary' || /放下|边界|自尊/.test(question)) {
    return COUNSELORS[1]
  }
  if (topicId === 'contact' || topicId === 'path' || /联系|说|聊天|怎么开口/.test(question)) {
    return COUNSELORS[2]
  }
  return COUNSELORS[0]
}

export function writeReading(topicId: string, question: string, counselor: Counselor) {
  const paragraphs = READING[topicId] || READING.path
  return {
    counselor,
    lead: `我读完了你写的「${question.slice(0, 18)}${question.length > 18 ? '…' : ''}」。`,
    body: paragraphs,
    practice: '今晚只做一件事：把你最想得到的那个回应，写成一句不超过 20 字的话。先不发送。明天再决定它配不配被发出去。',
    close: `${counselor.name} · ${counselor.title}`,
  }
}
