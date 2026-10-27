export type SkillType = 'listen' | 'speak' | 'read' | 'write' | 'mixed'
export type TerrainType = 'straight' | 'rugged'
export type LessonStatus = 'done' | 'current' | 'locked'

export interface Milestone {
  id: number
  title: string
  subtitle: string
  skill: string
  skillType: SkillType
  status: LessonStatus
  roadX: number
  roadY: number
  signX: number
  signY: number
  terrain: TerrainType
  terrainName: string
}

export const MILESTONES: Milestone[] = [
  {
    id: 1,
    title: 'Chào hỏi nhé',
    subtitle: 'Hello, how are you?',
    skill: 'Luyện nói',
    skillType: 'speak',
    status: 'done',
    roadX: 360,
    roadY: 130,
    signX: 428,
    signY: 130,
    terrain: 'straight',
    terrainName: 'Đại lộ Khởi Hành',
  },
  {
    id: 2,
    title: 'Tên mình là…',
    subtitle: 'My name is An',
    skill: 'Luyện nghe',
    skillType: 'listen',
    status: 'done',
    roadX: 520,
    roadY: 270,
    signX: 588,
    signY: 270,
    terrain: 'rugged',
    terrainName: 'Đèo Gió Uốn Lượn',
  },
  {
    id: 3,
    title: 'Bạn đến từ đâu?',
    subtitle: 'Where are you from?',
    skill: 'Luyện đọc',
    skillType: 'read',
    status: 'done',
    roadX: 320,
    roadY: 430,
    signX: 252,
    signY: 430,
    terrain: 'straight',
    terrainName: 'Cầu Thẳng Vượt Sông',
  },
  {
    id: 4,
    title: 'Gặp gỡ lần đầu',
    subtitle: 'Nice to meet you',
    skill: 'Đa kỹ năng',
    skillType: 'mixed',
    status: 'current',
    roadX: 360,
    roadY: 590,
    signX: 428,
    signY: 590,
    terrain: 'rugged',
    terrainName: 'Cung Rừng Rậm Gồ Ghề',
  },
  {
    id: 5,
    title: 'Giới thiệu bạn bè',
    subtitle: 'This is my friend',
    skill: 'Luyện nói',
    skillType: 'speak',
    status: 'locked',
    roadX: 360,
    roadY: 740,
    signX: 292,
    signY: 740,
    terrain: 'straight',
    terrainName: 'Cao Tốc Thẳng Tắp',
  },
  {
    id: 6,
    title: 'Một ngày của mình',
    subtitle: 'A day in my life',
    skill: 'Luyện nghe',
    skillType: 'listen',
    status: 'locked',
    roadX: 520,
    roadY: 900,
    signX: 588,
    signY: 900,
    terrain: 'rugged',
    terrainName: 'Hẻm Núi Gồ Ghề',
  },
  {
    id: 7,
    title: 'Đi đâu cuối tuần?',
    subtitle: 'Where shall we go?',
    skill: 'Luyện đọc',
    skillType: 'read',
    status: 'locked',
    roadX: 300,
    roadY: 1030,
    signX: 232,
    signY: 1030,
    terrain: 'straight',
    terrainName: 'Đoạn Thẳng Ven Biển',
  },
  {
    id: 8,
    title: 'Bưu thiếp đầu tiên',
    subtitle: 'Write a postcard',
    skill: 'Luyện viết',
    skillType: 'write',
    status: 'locked',
    roadX: 400,
    roadY: 1160,
    signX: 468,
    signY: 1160,
    terrain: 'rugged',
    terrainName: 'Đèo Dốc Đích Đến',
  },
]

// Alternating road path: Straight highway segments and rugged curvy passes
export const ROUTE =
  'M 360 20 L 360 130 C 360 170 480 180 500 215 C 515 240 470 250 520 270 L 320 430 C 290 470 200 485 220 525 C 240 565 320 570 360 590 L 360 740 C 360 780 490 790 515 825 C 530 855 450 870 520 900 L 300 1030 C 270 1065 330 1090 350 1120 C 370 1145 385 1150 400 1160'
