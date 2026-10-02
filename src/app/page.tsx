"use client";

import Image from "next/image";
import { CampusDot, CampusLabel, campusColor, campusShort } from "@/lib/campus";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileCheck2,
  FileImage,
  Images,
  Hash,
  KeyRound,
  LayoutGrid,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Maximize2,
  Megaphone,
  NotebookTabs,
  PanelsTopLeft,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wallet,
  ZoomIn,
  ChevronDown,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { FundSection } from "@/components/archive/fund-section";
import { LoginGate } from "@/components/archive/login-gate";
import { MembersSection } from "@/components/archive/members-section";
import { getMe } from "@/archive-api";
import { ComplianceSection } from "@/components/archive/compliance-section";
import { ProductionRequestsSection } from "@/components/archive/production-requests-section";
import { PromotionsSection } from "@/components/archive/promotions-section";

type Role = "staff" | "admin";
type ArchiveSection = "events" | "marketing" | "meetings";
type Section = ArchiveSection | "promotions" | "requests" | "fund" | "compliance" | "members";
type PublishStatus = "draft" | "published";

type Program = {
  id?: string;
  name: string;
  audience: string;
  schedule: string;
  instructors: string;
  description: string;
  sortOrder?: number;
};

type EventImage = {
  src: string;
  alt: string;
  caption?: string;
};

type EventRecord = {
  id: string;
  title: string;
  branch: string;
  startDate: string;
  endDate: string | null;
  venue: string;
  audiences: string[];
  eventType: string;
  participantCount: number;
  externalCount: number;
  budget: number | null;
  summary: string;
  preparation?: string;
  review: string;
  sourceUrl: string;
  sourceDate: string;
  sourceAuthor: string;
  status: PublishStatus;
  coverKey?: string | null;
  coverName?: string | null;
  imageUrl: string | null;
  galleryImages?: EventImage[];
  programs: Program[];
  tags?: string[];
  demo?: boolean;
};

type MarketingAsset = {
  id: string;
  title: string;
  branch: string;
  createdDate: string;
  assetType: string;
  target: string;
  channel: string;
  campaignYear: number;
  fileFormat: string;
  specifications?: string;
  quantity?: number;
  driveUrl?: string;
  notes: string;
  relatedEventId: string | null;
  previewUrl: string | null;
  sourceUrl: string | null;
  galleryImages?: EventImage[];
  status: PublishStatus;
  className?: string;
  headline?: string;
  kicker?: string;
  demo?: boolean;
};

type MeetingNote = {
  id: string;
  title: string;
  meetingDate: string;
  organization: string;
  location: string;
  participants: string;
  attendeeCount: number;
  purpose: string;
  summary: string;
  discussion: string;
  decisions: string;
  actionItems: string;
  source: string;
  status: PublishStatus;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  demo?: boolean;
};

const demoEvents: EventRecord[] = [
  {
    id: "tongjin-middle-school-career-mentoring-2026",
    title: "통진중학교 진로 멘토링 수업",
    branch: "외부 학교 연계",
    startDate: "2026-07-10",
    endDate: null,
    venue: "통진중학교 2층 1학년 교실",
    audiences: ["중학생", "외부 학생"],
    eventType: "진로 멘토링",
    participantCount: 23,
    externalCount: 23,
    budget: null,
    summary: "통진중학교 2학년 1개 반 학생 23명을 대상으로 웹툰 작가의 진로와 직업을 소개하고 크로키 실습을 진행한 진로 멘토링 수업입니다. 학생들이 직업 세계와 실기 과정을 함께 경험할 수 있도록 발표와 체험 수업으로 구성했습니다.",
    preparation: "수업 자료와 크로키 실습 준비물을 마련하고, 학원 브랜드 안내를 위해 학원 노트와 펜을 학생들에게 배부했습니다.",
    review: "진로 발표와 실습을 연계해 학생들이 웹툰 작가의 업무와 필요한 역량을 구체적으로 이해할 수 있었습니다. 학교 연계 수업을 통해 학원 브랜드를 알리고 학생들과 직접 소통하는 홍보 기회도 마련했습니다.",
    sourceUrl: "",
    sourceDate: "2026-07-10",
    sourceAuthor: "통진중학교 진로 멘토링 기록",
    status: "published",
    imageUrl: "./tongjin-career-mentoring-01.webp",
    galleryImages: [
      { src: "./tongjin-career-mentoring-01.webp", alt: "통진중학교 진로 멘토링 수업 전경", caption: "진로 멘토링 수업 전경" },
      { src: "./tongjin-career-mentoring-02.webp", alt: "웹툰 작가 진로와 직업 멘토링 발표", caption: "웹툰 작가 진로·직업 발표" },
      { src: "./tongjin-career-mentoring-03.webp", alt: "통진중학교 학생들의 크로키 실습", caption: "학생 크로키 실습" },
    ],
    programs: [
      { name: "1차시 · 웹툰 작가 진로·직업 안내", audience: "통진중학교 2학년 23명", schedule: "13:35부터", instructors: "현민T · 현렬T", description: "진로 관련 PPT를 활용해 웹툰 작가의 업무와 진로 준비 과정을 소개", sortOrder: 0 },
      { name: "2차시 · 크로키 실습", audience: "통진중학교 2학년 23명", schedule: "15:15까지", instructors: "현민T · 현렬T", description: "인체의 동세와 특징을 빠르게 관찰하고 표현하는 크로키 실습 진행", sortOrder: 1 },
    ],
    demo: true,
  },
  {
    id: "gurae-scholarship-awards-2026",
    title: "2026년 상반기 장학 시상",
    branch: "구래캠퍼스",
    startDate: "2026-07-07",
    endDate: null,
    venue: "구래캠퍼스 인포",
    audiences: ["재원생"],
    eventType: "장학 시상",
    participantCount: 55,
    externalCount: 0,
    budget: null,
    summary: "디자인예비반 약 16명, 애니예비반 약 25명, 전공준비반 14명 등 재원생 약 55명을 대상으로 2026년 상반기 장학 시상을 진행했습니다. 특강 시작 전 학습 태도와 실기의 중요성을 안내하고 실기우수상과 친구소개 공로상을 시상했습니다.",
    review: "친구소개 공로상 시상 때 학생들의 반응이 특히 좋았습니다. 실기우수상 선정에서 아쉽게 제외된 학생은 별도 상담 요청에 응해 원만하게 마무리했으며, 시상 결과를 전달할 때 선정 기준과 향후 보완 방향을 함께 안내하는 것이 중요하다는 점을 확인했습니다.",
    sourceUrl: "",
    sourceDate: "2026-07-07",
    sourceAuthor: "구래캠퍼스",
    status: "published",
    imageUrl: "./gurae-scholarship-awards-01.webp",
    galleryImages: [
      { src: "./gurae-scholarship-awards-01.webp", alt: "구래캠퍼스 2026년 상반기 장학 시상 전시", caption: "장학 시상 및 실기 우수작 전시" },
      { src: "./gurae-scholarship-awards-02.webp", alt: "장학 시상에 참여한 구래캠퍼스 학생들", caption: "장학 시상에 참여한 재원생" },
      { src: "./gurae-scholarship-awards-03.webp", alt: "구래캠퍼스 장학증서 수여 모습 1", caption: "장학증서 수여" },
      { src: "./gurae-scholarship-awards-04.webp", alt: "구래캠퍼스 장학증서 수여 모습 2", caption: "장학 시상 현장" },
    ],
    programs: [
      { name: "특강 전 정신교육", audience: "전체 참여 학생", schedule: "20:00부터", instructors: "이재민 원장", description: "특강 시작 전 학습 태도와 실기 훈련의 중요성을 안내", sortOrder: 0 },
      { name: "상반기 장학 시상", audience: "디자인예비반 · 애니예비반 · 전공준비반", schedule: "20:00–20:30", instructors: "이재민 원장", description: "실기우수상과 친구소개 공로상을 시상하고 학생들의 성과를 격려", sortOrder: 1 },
      { name: "시상 결과 개별 상담", audience: "상담 요청 학생", schedule: "시상 후", instructors: "이재민 원장", description: "실기우수상 선정에서 아쉽게 제외된 학생의 요청에 따라 개별 상담 진행", sortOrder: 2 },
    ],
    demo: true,
  },
  {
    id: "sau-pre-admission-counseling-2026",
    title: "디자인예비반 학부모 입시간담회·전공준비반 1:1 고교진학 상담",
    branch: "사우캠퍼스",
    startDate: "2026-06-27",
    endDate: "2026-07-22",
    venue: "사우캠퍼스 하이클래스반 · 메인 상담실",
    audiences: ["학부모", "재원생"],
    eventType: "입시간담회·진학상담",
    participantCount: 33,
    externalCount: 0,
    budget: null,
    summary: "디자인예비반 학부모 간담회와 미참석 가정의 개별 상담, 전공준비반 1:1 고교진학 상담을 연계해 총 33명을 대상으로 진행했습니다. 디자인예비반 간담회는 7월 4일과 11일 각 8명, 개별 상담은 7명, 전공준비반 상담은 10명이 참여했습니다.",
    preparation: "참석자 명찰 라벨과 서명용 명단을 준비했으며, 합격생 재현작과 시험·수업 우수작을 선별해 전시했습니다. 현수막과 입시 요강 출력물, 필기구, 간단한 음료와 과자를 준비하고 공간을 정리했으며, 간담회 참석자에게는 귀가 시 우산을 전달했습니다.",
    review: "실기 중요성과 입시 변화 내용을 구체적으로 안내한 뒤 특강 참여 횟수와 실기 수강 시수가 늘었습니다. 고교학점제 5등급의 9등급 환산과 실기 반영 비율 확대 안내에도 긍정적인 반응이 있었고, 전공준비반 학부모는 고등학교 안내에 높은 만족도를 보였습니다. 미참석 학부모는 별도 연락과 개인 상담을 통한 지속 관리가 필요합니다.",
    sourceUrl: "",
    sourceDate: "2026-07-22",
    sourceAuthor: "사우캠퍼스",
    status: "published",
    imageUrl: "./sau-pre-admission-counseling-01.webp",
    galleryImages: [
      { src: "./sau-pre-admission-counseling-01.webp", alt: "사우캠퍼스 학부모 입시간담회 준비 현장", caption: "학부모 입시간담회 준비 현장" },
      { src: "./sau-pre-admission-counseling-02.webp", alt: "사우캠퍼스 우수작 전시와 간담회 공간", caption: "합격생 재현작과 우수작 전시" },
      { src: "./sau-pre-admission-counseling-03.webp", alt: "사우캠퍼스 메인 상담실 상담 준비 모습", caption: "메인 상담실 1:1 상담 준비" },
    ],
    programs: [
      { name: "디자인예비반 학부모 입시간담회", audience: "디자인예비반 학부모 16명", schedule: "7월 4일 · 7월 11일", instructors: "윤진아 원장", description: "AI 시대의 디자인 비전, 2028학년도 입시 변화, 고교학점제와 전형·실기 유형 안내", sortOrder: 0 },
      { name: "디자인예비반 개별 상담", audience: "하이클래스 및 간담회 미참석 가정 7명", schedule: "6월 27일–7월 22일 중 개별 일정", instructors: "윤진아 원장", description: "간담회 미참석 가정을 대상으로 입시 방향과 실기 준비 과정을 개별 안내", sortOrder: 1 },
      { name: "전공준비반 1:1 고교진학 상담", audience: "전공준비반 학부모·학생 10명", schedule: "6월 27일–7월 22일 중 개별 일정", instructors: "윤진아 원장", description: "디자인·애니메이션 직업 전망과 김포 지역 고등학교·예술고 진학 정보를 1:1로 상담", sortOrder: 2 },
      { name: "공통 입시·실기 안내 및 질의응답", audience: "전체 상담 참여자", schedule: "회차별 진행", instructors: "윤진아 원장", description: "본원 합격 사례와 실기의 중요성, 특강 참여 필요성을 안내하고 미대 입시 관련 질문에 답변", sortOrder: 3 },
    ],
    demo: true,
  },
  {
    id: "sau-design-admissions-briefing-2026",
    title: "디자인입시반 입시설명회",
    branch: "사우캠퍼스",
    startDate: "2026-07-18",
    endDate: null,
    venue: "사우캠퍼스 하이클래스반",
    audiences: ["학부모", "재원생"],
    eventType: "입시설명회",
    participantCount: 23,
    externalCount: 0,
    budget: null,
    summary: "디자인입시반 학부모와 학생 19팀, 총 23명을 대상으로 2027학년도 대입 변화와 전형·실기 유형, 본원 합격 사례와 연간 계획을 안내하고 개별 상담과 질의응답을 진행한 입시설명회입니다.",
    preparation: "참석자 명찰 스티커와 참석 명단을 준비해 현장에서 확인했으며, 합격생 재현작과 시험·수업 우수작을 선정해 전시했습니다. 현수막과 입시 요강 출력물, 필기구, 간단한 음료와 과자를 준비하고 행사 후 전시물과 공간을 정리했습니다.",
    review: "학부모와의 신뢰를 형성했으며, 평소 소통이 적었던 학부모도 참석해 미대 입시에 관한 궁금증을 해소할 수 있었습니다.",
    sourceUrl: "",
    sourceDate: "2026-07-18",
    sourceAuthor: "사우캠퍼스",
    status: "published",
    imageUrl: "./sau-admissions-briefing-01.webp",
    galleryImages: [
      { src: "./sau-admissions-briefing-01.webp", alt: "사우캠퍼스 디자인입시반 입시설명회 진행 모습 1", caption: "입시설명회 진행 현장" },
      { src: "./sau-admissions-briefing-02.webp", alt: "사우캠퍼스 디자인입시반 입시설명회 진행 모습 2", caption: "2027학년도 미대입시 변화 안내" },
    ],
    programs: [
      { name: "디자인입시반 및 2027학년도 입시 안내", audience: "디자인입시반 학부모·학생", schedule: "13:00–15:00", instructors: "윤진아 원장 · 이호문 부원장", description: "디자인 입시반 소개와 2027학년도 입시 변동사항 안내", sortOrder: 0 },
      { name: "전형·실기 유형 안내", audience: "디자인입시반 학부모·학생", schedule: "설명회 진행", instructors: "윤진아 원장 · 이호문 부원장", description: "전형 방식과 실기 유형을 안내하고 특강 실기의 중요성을 설명", sortOrder: 1 },
      { name: "합격 사례 및 연간 계획 안내", audience: "디자인입시반 학부모·학생", schedule: "설명회 진행", instructors: "윤진아 원장 · 이호문 부원장", description: "본원 합격 사례와 디자인입시반의 연간 운영 계획 공유", sortOrder: 2 },
      { name: "개별 상담 및 질의응답", audience: "디자인입시반 학부모·학생", schedule: "설명회 후반", instructors: "윤진아 원장 · 이호문 부원장", description: "가정별 궁금증을 확인하고 개별 상담과 질의응답 진행", sortOrder: 3 },
    ],
    demo: true,
  },
  {
    id: "geomdan-art-exhibition-2026",
    title: "검단 그림전시회",
    branch: "검단캠퍼스",
    startDate: "2026-09-12",
    endDate: null,
    venue: "검단하이파이브",
    audiences: ["재원생", "학부모", "외부 방문객"],
    eventType: "전시회",
    participantCount: 135,
    externalCount: 35,
    budget: 950350,
    summary: "초등 46점, 중등 20점, 고등 16점 등 총 82점의 작품을 전시하고 슈링클스 키링 만들기, 솜사탕·팝콘 체험, 학부모 입시 상담을 함께 진행한 검단캠퍼스 그림전시회입니다.",
    review: "가족과 외부 방문객이 예상보다 많이 참여해 슈링클스 종이와 키링 재료가 부족했습니다. 다음 행사에는 최대 방문 인원을 기준으로 체험 재료를 준비하고 방명록 담당을 별도로 배치할 필요가 있습니다. 블로그·SNS·맘카페와 오프라인 홍보물을 활용한 사전 홍보, 학년별 체험 콘텐츠 기획도 보완사항으로 정리했습니다. 학부모 만족도가 높았으며 가족 단위 방문과 입시 상담 반응도 좋았습니다.",
    sourceUrl: "",
    sourceDate: "2026-09-12",
    sourceAuthor: "검단캠퍼스 평가보고서",
    status: "published",
    imageUrl: "./geomdan-exhibition-01.webp",
    galleryImages: Array.from({ length: 13 }, (_, index) => ({
      src: `./geomdan-exhibition-${String(index + 1).padStart(2, "0")}.webp`,
      alt: `검단 그림전시회 행사 사진 ${index + 1}`,
      caption: `행사 진행사진 ${index + 1}`,
    })),
    programs: [
      { name: "학생 작품 전시", audience: "재원생 · 학부모 · 외부 방문객", schedule: "09:00–18:00", instructors: "검단캠퍼스", description: "초등 46점, 중등 20점, 고등 16점 등 총 82점의 작품을 종이 액자와 이젤로 전시", sortOrder: 0 },
      { name: "슈링클스 키링 만들기", audience: "학생 · 가족 방문객", schedule: "상시 진행", instructors: "김은솔전임 · 김고은전임", description: "아크릴 마카로 슈링클스 작품을 제작하고 키링으로 완성하는 체험수업", sortOrder: 1 },
      { name: "솜사탕·팝콘 체험", audience: "전체 방문객", schedule: "상시 운영", instructors: "하정은실장", description: "대여 기계를 활용한 현장 간식 체험 및 가족 참여 프로그램", sortOrder: 2 },
      { name: "학부모 입시 상담", audience: "중·고등 학부모", schedule: "현장 상담", instructors: "조효정원장 · 김민진원장", description: "기존 1:1 컨설팅에 참여하지 못한 학부모를 포함한 미대 입시 상담", sortOrder: 3 },
    ],
    demo: true,
  },
  {
    id: "demo-family-month-2025",
    title: "가정의 달 및 신입창출 이벤트",
    branch: "사우캠퍼스",
    startDate: "2025-04-26",
    endDate: "2025-05-08",
    venue: "사우캠퍼스 각 반",
    audiences: ["신입생", "학부모"],
    eventType: "기념일",
    participantCount: 60,
    externalCount: 0,
    budget: 450000,
    summary: "가정의 달을 맞아 반별 작품 제작과 신입생 창작 체험을 함께 진행한 행사입니다.",
    review: "캐리커처와 카네이션 조화 프로그램의 반응이 좋았습니다. 다음 행사에는 반별 소요 재료를 미리 구분해 두면 준비 시간을 줄일 수 있습니다.",
    sourceUrl: "",
    sourceDate: "2025-05-10",
    sourceAuthor: "김포사업기획원장",
    status: "published",
    imageUrl: "./sample-event.webp",
    galleryImages: [
      { src: "./sample-event.webp", alt: "가정의 달 이벤트 시안용 사진 1", caption: "사진 1 · 다중 사진 동작 시안" },
      { src: "./sample-event.webp", alt: "가정의 달 이벤트 시안용 사진 2", caption: "사진 2 · 다중 사진 동작 시안" },
      { src: "./sample-event.webp", alt: "밴드에 게시된 행사 원문 화면", caption: "사진 3 · 밴드 원문 캡처" },
    ],
    programs: [
      { name: "디자인예비", audience: "가정의 달", schedule: "반별 진행", instructors: "경림T · 하린T", description: "캐리커처와 카네이션 조화", sortOrder: 0 },
      { name: "애니예비", audience: "가정의 달", schedule: "반별 진행", instructors: "은혜T · 지현T", description: "캐리커처와 카네이션 조화", sortOrder: 1 },
      { name: "신입창출 이벤트", audience: "신입생", schedule: "15:00–17:00", instructors: "진행 강사", description: "슈링클스와 모루인형 키링 만들기", sortOrder: 2 },
    ],
    demo: true,
  },
  {
    id: "demo-open-class-2025",
    title: "봄학기 학부모 공개수업",
    branch: "김포캠퍼스",
    startDate: "2025-03-15",
    endDate: null,
    venue: "김포캠퍼스",
    audiences: ["학부모", "재원생"],
    eventType: "공개수업",
    participantCount: 42,
    externalCount: 0,
    budget: 280000,
    summary: "학부모가 수업 과정과 학생 작품을 함께 살펴본 공개수업입니다.",
    review: "수업 과정을 직접 확인할 수 있어 만족도가 높았습니다.",
    sourceUrl: "",
    sourceDate: "2025-03-16",
    sourceAuthor: "",
    status: "published",
    imageUrl: null,
    programs: [],
    demo: true,
  },
  {
    id: "demo-creative-day-2025",
    title: "신입생 창작 체험 데이",
    branch: "운양캠퍼스",
    startDate: "2025-02-22",
    endDate: null,
    venue: "운양캠퍼스",
    audiences: ["신입생"],
    eventType: "체험 행사",
    participantCount: 35,
    externalCount: 18,
    budget: null,
    summary: "처음 방문한 학생이 다양한 재료로 작품을 완성하는 체험 행사입니다.",
    review: "외부 학생의 재방문 문의가 많았습니다.",
    sourceUrl: "",
    sourceDate: "2025-02-23",
    sourceAuthor: "",
    status: "published",
    imageUrl: null,
    programs: [],
    demo: true,
  },
];

function marketingGallery(group: string, title: string, extensions: string[]): EventImage[] {
  return extensions.map((extension, index) => ({
    src: `./marketing/${group}-${String(index + 1).padStart(2, "0")}.webp`,
    alt: `${title} 제작물 ${index + 1}`,
    caption: `${title} · ${index + 1}`,
  }));
}

const demoAssets: MarketingAsset[] = [
  {
    id: "archive-kimpo-after-portfolio",
    title: "학생 작품 비포·애프터 포트폴리오",
    branch: "김포캠퍼스",
    createdDate: "2026-09-17",
    assetType: "성과 홍보물",
    target: "학생·학부모",
    channel: "SNS",
    campaignYear: 2026,
    fileFormat: "PNG",
    notes: "학생의 드로잉 발전 과정을 비포·애프터 형식으로 정리한 김포캠퍼스 성과 홍보물 5종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/800930514-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("800930514", "학생 작품 비포·애프터 포트폴리오", Array(5).fill("png")),
    status: "published",
    demo: true,
  },
  {
    id: "archive-admission-prep-recruitment",
    title: "청강대·디자인 입시 준비반 모집",
    branch: "본사 공통",
    createdDate: "2026-09-17",
    assetType: "모집 포스터",
    target: "입시생",
    channel: "SNS",
    campaignYear: 2026,
    fileFormat: "PNG",
    notes: "청강대 준비반과 디자인 정시반 모집 내용을 분리해 안내한 세로형 SNS 포스터 2종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/801171337-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("801171337", "청강대·디자인 입시 준비반 모집", Array(2).fill("png")),
    status: "published",
    demo: true,
  },
  {
    id: "archive-kimpo-competition-results-one",
    title: "2026 대학 실기대회·공모전 수상 홍보",
    branch: "김포캠퍼스",
    createdDate: "2026-09-17",
    assetType: "수상 홍보물",
    target: "학생·학부모",
    channel: "SNS",
    campaignYear: 2026,
    fileFormat: "PNG",
    notes: "동덕여대·수원대·신경주대·청강문화산업대 수상 실적을 소개하는 홍보물 4종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/801642183-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("801642183", "2026 대학 실기대회·공모전 수상 홍보", Array(4).fill("png")),
    status: "published",
    demo: true,
  },
  {
    id: "archive-kimpo-swa-award",
    title: "2026 SWA 교수평가 공모전 수상 홍보",
    branch: "김포캠퍼스",
    createdDate: "2026-09-17",
    assetType: "수상 홍보물",
    target: "학생·학부모",
    channel: "SNS",
    campaignYear: 2026,
    fileFormat: "PNG",
    notes: "SWA 교수평가 공모전 최우수상·우수상 수상자를 정리한 성과 홍보물입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/801847803-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("801847803", "2026 SWA 교수평가 공모전 수상 홍보", ["png"]),
    status: "published",
    demo: true,
  },
  {
    id: "archive-kimpo-national-evaluation",
    title: "2026 전국 강사연구작 품평회 수상",
    branch: "김포캠퍼스",
    createdDate: "2026-09-17",
    assetType: "수상 홍보물",
    target: "학생·학부모",
    channel: "SNS",
    campaignYear: 2026,
    fileFormat: "JPG",
    notes: "전국 강사연구작 품평회 최우수상·우수상 작품과 상장을 함께 소개한 성과 홍보물 14종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/803046711-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("803046711", "2026 전국 강사연구작 품평회 수상", Array(14).fill("jpg")),
    status: "published",
    demo: true,
  },
  {
    id: "archive-major-guidebook",
    title: "미술·디자인 진학 분야 안내책자",
    branch: "본사 공통",
    createdDate: "2026-09-17",
    assetType: "입시 안내책자",
    target: "입시생·학부모",
    channel: "상담·배포",
    campaignYear: 2026,
    fileFormat: "PNG",
    notes: "AI·시각·영상·산업·실내·공예·패션·뷰티·웹툰·게임 등 미술 및 디자인 진학 분야를 소개하는 30쪽 안내책자입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/803133013-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("803133013", "미술·디자인 진학 분야 안내책자", Array(30).fill("png")),
    status: "published",
    demo: true,
  },
  {
    id: "archive-kimpo-geomdan-awards",
    title: "김포·검단 2026 수상 실적 홍보",
    branch: "김포·검단 공동",
    createdDate: "2026-09-17",
    assetType: "수상 홍보물",
    target: "학생·학부모",
    channel: "SNS",
    campaignYear: 2026,
    fileFormat: "PNG",
    notes: "김포와 검단 캠퍼스의 공모전·실기대회 수상 실적을 함께 정리한 공동 홍보물 6종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/803254820-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("803254820", "김포·검단 2026 수상 실적 홍보", Array(6).fill("png")),
    status: "published",
    demo: true,
  },
  {
    id: "archive-kimpo-autumn-recruitment",
    title: "김포 가을학기 모집 홍보 패키지",
    branch: "김포캠퍼스",
    createdDate: "2026-09-17",
    assetType: "모집 홍보물",
    target: "신입생·학부모",
    channel: "SNS·인쇄",
    campaignYear: 2026,
    fileFormat: "PNG",
    notes: "가을학기 모집, 디자인·애니 전공 안내, 지점 소개, 와콤 신티크 수업을 묶은 홍보물 4종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/804694974-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("804694974", "김포 가을학기 모집 홍보 패키지", Array(4).fill("png")),
    status: "published",
    demo: true,
  },
  {
    id: "archive-kimpo-contest-grand-prize",
    title: "2026 미술·만화 공모전 대상 수상",
    branch: "김포캠퍼스",
    createdDate: "2026-09-17",
    assetType: "수상 홍보물",
    target: "학생·학부모",
    channel: "SNS",
    campaignYear: 2026,
    fileFormat: "JPG",
    notes: "대진대학교와 한국영상대학교 공모전 대상 및 우수상 수상 실적을 소개한 홍보물 2종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/804997225-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("804997225", "2026 미술·만화 공모전 대상 수상", Array(2).fill("jpg")),
    status: "published",
    demo: true,
  },
  {
    id: "archive-gimhae-launch-package",
    title: "김해캠퍼스 오픈·입시 홍보 패키지",
    branch: "김해캠퍼스",
    createdDate: "2026-09-17",
    assetType: "브랜드 홍보물",
    target: "신입생·학부모",
    channel: "SNS·인쇄",
    campaignYear: 2026,
    fileFormat: "JPG",
    notes: "2026년 10월 오픈 안내, 커리큘럼, 입시 성과, 원데이 클래스와 앱 안내를 묶은 김해캠퍼스 홍보물 8종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/806300379-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("806300379", "김해캠퍼스 오픈·입시 홍보 패키지", Array(8).fill("jpg")),
    status: "published",
    demo: true,
  },
  {
    id: "archive-busan-centum-package",
    title: "부산 센텀캠퍼스 브랜드·입시 홍보",
    branch: "부산캠퍼스",
    createdDate: "2026-09-17",
    assetType: "브랜드 홍보물",
    target: "신입생·학부모",
    channel: "SNS·상담",
    campaignYear: 2026,
    fileFormat: "JPG",
    notes: "센터 소개, 입시 합격 성과, 미대입시 과정, 커리큘럼, 앱과 진학 준비 과정을 정리한 부산 센텀캠퍼스 홍보물 13종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/806302667-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("806302667", "부산 센텀캠퍼스 브랜드·입시 홍보", Array(13).fill("jpg")),
    status: "published",
    demo: true,
  },
  {
    id: "archive-kimpo-geomdan-artist-talk",
    title: "김포·검단 웹툰 작가 시연회",
    branch: "김포·검단 공동",
    createdDate: "2026-09-17",
    assetType: "행사 포스터",
    target: "학생·학부모",
    channel: "SNS·현수막",
    campaignYear: 2026,
    fileFormat: "JPG · JPEG",
    notes: "남수현·임규현 작가 시연회 안내를 위한 현수막과 세로형 포스터 3종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/806344549-02.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("806344549", "김포·검단 웹툰 작가 시연회", ["jpeg", "jpg", "jpg"]),
    status: "published",
    demo: true,
  },
  {
    id: "archive-kimpo-chuseok-card",
    title: "추석 인사 카드",
    branch: "김포캠퍼스",
    createdDate: "2026-09-17",
    assetType: "시즌 인사",
    target: "전체",
    channel: "SNS·메신저",
    campaignYear: 2026,
    fileFormat: "PNG",
    notes: "김포캠퍼스 공통 브랜드를 적용한 추석 인사 카드입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/806588271-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("806588271", "추석 인사 카드", ["png"]),
    status: "published",
    demo: true,
  },
  {
    id: "archive-kimpo-wacom-course",
    title: "와콤 태블릿 디지털 드로잉 모집",
    branch: "김포캠퍼스",
    createdDate: "2026-09-17",
    assetType: "모집 포스터",
    target: "학생·학부모",
    channel: "SNS",
    campaignYear: 2026,
    fileFormat: "PNG",
    notes: "와콤 태블릿을 활용한 캐릭터·웹툰 드로잉 수업을 안내하는 모집 포스터 2종입니다.",
    relatedEventId: null,
    previewUrl: "./marketing/807492110-01.webp",
    sourceUrl: null,
    galleryImages: marketingGallery("807492110", "와콤 태블릿 디지털 드로잉 모집", Array(2).fill("png")),
    status: "published",
    demo: true,
  },
  {
    id: "demo-may-social",
    title: "가정의 달 SNS 홍보물",
    branch: "사우캠퍼스",
    createdDate: "2025-04-18",
    assetType: "SNS",
    target: "학부모",
    channel: "인스타그램",
    campaignYear: 2025,
    fileFormat: "PSD · JPG",
    notes: "가정의 달 행사 홍보용 세로형 콘텐츠",
    relatedEventId: "demo-family-month-2025",
    previewUrl: null,
    sourceUrl: null,
    status: "published",
    className: "marketing-art-one",
    headline: "마음을\n그려드려요",
    kicker: "2025 MAY EVENT",
    demo: true,
  },
  {
    id: "demo-open-class-poster",
    title: "학부모 공개수업 포스터",
    branch: "김포캠퍼스",
    createdDate: "2025-03-02",
    assetType: "포스터",
    target: "학부모",
    channel: "원내 게시",
    campaignYear: 2025,
    fileFormat: "AI · PDF",
    notes: "A3 출력용 포스터",
    relatedEventId: "demo-open-class-2025",
    previewUrl: null,
    sourceUrl: null,
    status: "published",
    className: "marketing-art-two",
    headline: "봄학기\n공개수업",
    kicker: "OPEN CLASS",
    demo: true,
  },
  {
    id: "demo-creative-banner",
    title: "신입생 체험수업 웹 배너",
    branch: "본사 공통",
    createdDate: "2025-02-10",
    assetType: "웹 배너",
    target: "신입생",
    channel: "홈페이지",
    campaignYear: 2025,
    fileFormat: "FIG · PNG",
    notes: "지점 공통으로 재사용 가능한 배너",
    relatedEventId: null,
    previewUrl: null,
    sourceUrl: null,
    status: "published",
    className: "marketing-art-three",
    headline: "창작 체험\nDAY",
    kicker: "NEW STUDENT",
    demo: true,
  },
];

const demoMeetings: MeetingNote[] = [
  {
    id: "meeting-design-practical-2026-09-23",
    title: "디자인 실기파트 연합 회의 · 사전 안내",
    meetingDate: "2026-09-23",
    organization: "김해·명지·센텀 실기파트",
    location: "김해 본관",
    participants: "김해·명지·센텀 각 캠퍼스 실기 담당자",
    attendeeCount: 0,
    purpose: "각 관의 실기 관련 업무를 분담해 공유하고, 세 캠퍼스가 함께 활용·운영할 수 있는 실기 자료와 협업 방식을 구체화합니다.",
    summary: "대학 실기대회 수상작과 우수 Hi5 캠퍼스 사례를 조사하고, 학생 작품과 수업 사례를 함께 분석합니다. 대학별 담당제, 공동 자료 축적, 블라인드 교차 품평, 공동 실전고사와 학생별 성장기록 운영 방식을 논의하는 사전 회의 안내입니다.",
    discussion: `1. 2026 대학 실기대회 수상작 조사
김해: 영남대·동명대·동서대·경성대·동아대
명지: 서울여대·상명대(서울)·동덕여대·한성대·삼육대
센텀: 가천대·건국대 글로컬·중앙대·수원대·인하대
대학별 기초디자인 본상 수상작과 공통 특징 2~3가지를 준비하며, 공개자료가 부족한 대학은 확인 가능한 범위까지만 조사합니다.

2. 우수 Hi5 캠퍼스 사례 조사
수상작·합격작, 학생 성장 과정, 예비반 수업 방식, 실전시험과 품평, 학생 피드백, 좋은 결과로 이어진 운영 방법을 수집합니다. 담당 캠퍼스와 자료 공유 범위는 회의에서 최종 결정합니다.

3. 각 관 실기자료
학생들에게 반복되는 실기 문제점, 함께 분석할 학생작 3~5점, 최근 효과가 좋았던 수업과 수업 방법을 준비합니다.

4. 공동 논의 안건
대학별 담당제와 업데이트 방식, 수상·합격작 공동 축적, 실패작→수정작→성장작 사례, 3캠퍼스 블라인드 교차 품평과 공동 실전고사, 학생별 성장기록, 공동 실기자료 제작과 업무 분담, 공통 자료 적용·검증 일정을 논의합니다.`,
    decisions: `회의 참석 전 담당 자료를 준비합니다.
그림 스타일 통합을 위해 각 실기 담당자는 괜찮다고 판단한 기초디자인 작품을 30장 이상 수집합니다.
참고작은 Hi5 외 타 학원 작품도 포함할 수 있습니다.`,
    actionItems: `김해: 부산·경상권 5개 대학 수상작 조사
명지: 서울권 5개 대학 수상작 조사
센텀: 경기·인천·충청권 5개 대학 수상작 조사
각 담당자: 기초디자인 참고작 30장 이상과 분석 대상 학생작 3~5점 준비
각 캠퍼스: 반복 실기 문제와 효과가 좋았던 수업 사례 정리`,
    source: "사용자 제공 디자인 실기파트 회의 안내",
    status: "published",
    demo: true,
  },
  {
    id: "meeting-animation-part-2026-09-17",
    title: "애니파트 연합 회의",
    meetingDate: "2026-09-17",
    organization: "율하·명지·센텀 애니파트",
    location: "율하캠퍼스",
    participants: "김단비 전임(율하), 신재이 부원장·김진서 전임(명지), 김세윤 원장(센텀)",
    attendeeCount: 4,
    purpose: "세 캠퍼스의 애니메이션 실기 운영과 결과를 비교하고, 합격 자료 공유·공모전 운영·실기 연구·입시 연계의 공동 기준과 후속 과제를 정합니다.",
    summary: "명지·율하·센텀의 연간 커리큘럼과 공모전·실기대회·연합시험 결과를 점검했습니다. 커리큘럼을 먼저 일괄 통일하기보다 교사의 실기 기준과 지도 방향을 맞추는 연구를 우선하고, 합격생 자료 공동 축적, 공모전 분산 참여, 학년별 입시 연계와 2027년 공동평가 운영안을 단계적으로 구체화하기로 했습니다.",
    discussion: `1. 캠퍼스별 커리큘럼과 결과 점검
명지는 기초 과목 수업에서 화면 구성·공간 연출·빛과 색·투시·캐릭터 표현을 상황표현과 칸만화에 연결하고 있으나 월별 연결성을 보완할 필요가 있습니다. 율하는 특강·연합평가·공모전을 중심으로 이론과 실기를 연결하고, 센텀은 신규 학생 중심의 개별 수업 후 내년부터 공동 연구 방향을 반영한 커리큘럼을 구성하기로 했습니다.

명지 공모전 수상률은 86%였고 청강대 공모전은 9명 중 4명이 수상했습니다. 율하는 실기대회 성과 대비 공모전 결과가 낮아 방향성 차이를 분석하기로 했으며, 센텀은 올해 입시반이 구성되지 않아 내년 상반기까지 참여가 어려울 수 있음을 공유했습니다.

2. 연합시험 A권 작품 분석
캠퍼스별 주제부 강조, 배경 묘사량, 색의 채도와 조명, 패턴·레이어·시점·인물 배치에 차이가 있었습니다. 불필요한 요소를 덜어 주제부를 선명하게 하고, 높은 채도는 강조 영역에 제한하며 나머지는 차분하게 눌러주는 방향을 공통 연구 과제로 정리했습니다.

3. 합격생 자료와 공모전 운영
세 캠퍼스가 합격생의 재현작·평소작·내신·수능 등급·실기 경력을 공유하기로 했습니다. 공모전은 예비반 학생이 가능하면 1회 이상 참여하되 주요 대회는 가능성이 높은 학생을 집중 지도하고, 나머지는 다른 대회로 분산하는 방안을 논의했습니다.

4. 스타일과 실기 방향성 연구
평가의 우선 기준을 문해력·주제 해석과 제한 시간 내 완성도로 정리했습니다. 칸만화는 이야기·연출·재미, 이미지보드는 카메라와 화면 연출, 게임·융합 계열은 요구 조건을 빠짐없이 해석하는 능력이 중요하다고 보았습니다. 커리큘럼 통일보다 교사가 같은 주제와 조건으로 직접 연구하고 과정과 결과를 비교하는 방식을 우선합니다.

5. 입시반→예비반 연계
고1은 다양한 수업 경험과 진로 탐색, 고2는 입시 방향 전환과 전공별 데포르메·표현 방식, 고3은 기본기 위에서 전공과 개인 강점을 빠르게 정리하는 방향으로 운영합니다. 여러 교사가 함께 지도할 때는 자료와 기준을 공유하되 피드백 혼선을 줄일 운영 방식은 추가 논의하기로 했습니다.`,
    decisions: `합격생 전체를 대상으로 학교별 재현작·평소작·성적·실기 경력 자료를 축적하고, 수시 결과 이후 학교별 폴더로 정리합니다.
예비반은 가능한 범위에서 1회 이상 공모전에 참여하며 주요 대회 집중 지도와 타 대회 분산 출품을 병행합니다.
세 캠퍼스 커리큘럼을 바로 통일하지 않고 교사 실기 연구와 지도 기준 정렬을 먼저 진행합니다.
첫 공동 연구 주제는 최근 결과가 좋은 송도캠퍼스의 상황표현 방식으로 정합니다.
애니하이·패스·SWG 등 물감을 비교한 뒤 재료와 채색 방식의 통일 여부를 다시 판단합니다.
2027년부터 애니파트 입시반 대상 월 1회 3캠퍼스 연합 월말평가를 검토하고, 자체 공모전은 내년 도입 방향으로 검토합니다.`,
    actionItems: `각 캠퍼스: 합격생별 재현작, 평소작 3~4점, 내신·수능 등급, 실기 경력, 필요 시 지원 전형과 실기 종목 정리
각 담당자: 10월 회의 전까지 송도캠퍼스 상황표현 방식을 직접 연구하고 실물 지참
각 담당자: 단계별 과정 사진·영상, 사용 재료, 장단점, 지도에 적용할 부분 정리
율하: 비교 연구용 물감 우선 구매 및 추가 담당 교사 참석 여부 확인
공통: 다음 연구 주제와 재료 통일 여부를 10월 회의에서 결정
차기 회의: 2026년 10월 21일 오전 10시`,
    source: "26년 9월 애니파트 회의록 PDF",
    status: "published",
    demo: true,
  },
  {
    id: "meeting-elementary-part-2026-09-17",
    title: "초·중등 파트 연합 운영 회의",
    meetingDate: "2026-09-17",
    organization: "김해·명지·센텀 초·중등 파트",
    location: "김해캠퍼스",
    participants: "명지·김해·센텀 초·중등 파트장 및 원장단",
    attendeeCount: 0,
    purpose: "캠퍼스별 초·중등반 운영과 학생 관리 과정을 공유하고, 재등록 관리와 공모전 출품, 수업 자료의 공동 운영 체계를 마련합니다.",
    summary: "캠퍼스별 재원·휴퇴원 현황과 현장 수업 난점, 상위반 연계, 공모전 결과를 비교했습니다. 정규 커리큘럼과 체험수업 운영, 아이소식 작성, 공모전 공동 대응, 교육 자료 축적을 세 캠퍼스가 함께 관리하는 방향으로 실행 항목을 정리했습니다.",
    discussion: `캠퍼스 현황
김해: 총원 101명, 실인원 82명, 휴원 19명. 초등 실원 42명, 중등 실원 40명.
센텀: 실인원 9명. 방학 단기수강 포함 16명까지 운영 후 재등록 미전환 9명.
명지: 총원 105명, 실인원 94명, 휴원 11명. 초등 실원 43명, 중등 실원 51명.

주요 운영 이슈
상위반 진입 전 이탈 방지, 학기당 집중 상담, 초·중등 수업의 집중도와 반복 태도 문제, 신입 강사 대응 매뉴얼, 조기 진로 희망과 기초 티칭의 한계를 논의했습니다.

공모전·미술대회
김해는 국제캐릭터콘텐츠공모대전 출품 21명 전원 수상과 국토교통기술대전·나라사랑 태극무궁화 예술대전 결과를 공유했습니다. 센텀은 대현도서관 웹툰·거꾸로하트·효녀심청 공모전 진행 현황을, 명지는 국제학생미술대회·미래내모습·대진대·상명대 결과를 공유했습니다.

운영 자료와 교재
신입 강사 현장 대응, 수업 방해·문제 행동의 단계별 조치, 조기 전공 희망 학생을 위한 기초 티칭 매뉴얼 필요성을 확인했습니다. 김해는 형태·입체감·공간감·배색·주제 강조·화면 구성·연상·수정 과정을 학생 질문 중심으로 설명하는 구상 초급 기초 교재 방향을 제안했습니다.`,
    decisions: `월별 대주제만 전 관 공통으로 정하고 세부 실기 연출과 수업 기법은 캠퍼스가 자율 제작한 뒤 공유합니다.
우수작 기준은 각 캠퍼스 기존 수업 중 학생 반응과 선호가 검증된 커리큘럼을 취합해 교차 활용합니다.
체험수업은 예약→완성작 전달·당일 업로드→상담·피드백→첫 수업 확정의 4단계로 운영합니다.
명지캠퍼스 체험수업 자료를 김해·센텀에 ZIP으로 공유하고, 활용 결과를 반영해 2027년 3월 자료 전면 최신화를 추진합니다.
아이소식은 학부모가 성장과 수업 집중도를 느낄 수 있는 분량과 내용으로 작성합니다.
동일 공모전 몰림을 방지하고 캠퍼스별 특색에 맞게 분산 출품합니다.
초·중등 파트 전용 네이버 밴드를 개설해 강사 교육자료, 학부모 상담 Q&A, 원내 블로그 작성 예시와 현장 대응 사례를 축적합니다.
교차 참관은 특정 캠퍼스 전담 방식 대신 분야별로 나누고 필요 시 요청 기반으로 일정을 조율합니다.`,
    actionItems: `명지: 현재 사용 중인 체험수업 자료를 김해·센텀에 ZIP으로 공유
각 캠퍼스: 공유 자료 활용 후 학생 선호도와 등록 전환 반응 정리
공통: 활용 결과를 반영해 2027년 3월 체험수업 자료 전면 최신화
매월 초: 다음 공모전 일정 공유 및 캠퍼스별 분산 출품 계획 수립
대회 종료 후: 수상작 분석과 교사 개입도·지도 방향 사후 브리핑
공통: 초·중등 파트 전용 네이버 밴드 개설 및 교육·상담·현장 대응 자료 축적
차기 회의: 2026년 11월 6일(금) 오전 10시, 센텀캠퍼스
차기 집중 논의: 초·중등 휴퇴원 방어와 월별 집중 휴원 시기 선제 대응`,
    source: "2026년 9월 초중등 파트 회의록 PDF",
    status: "published",
    demo: true,
  },
  {
    id: "meeting-academy-system-2026-09-09",
    title: "통합 학원 시스템 개발 기능 기획 회의",
    meetingDate: "2026-09-09",
    organization: "전 캠퍼스 통합 시스템 기획",
    location: "미기재",
    participants: "회의 참석자 5명(전사본 발화자 기준)",
    attendeeCount: 5,
    purpose: "캠퍼스에 분산된 학생 등록, 상담, 수업, 출결, 작품, 학부모 공유, 수납·정산 업무를 하나의 학생 데이터로 연결하는 통합 학원 시스템을 기획합니다.",
    summary: "시스템의 중심을 AI 기능 자체보다 반복 행정을 줄이는 통합 운영 구조에 두고, 학생 한 명의 상담부터 등록·수업·출결·작품·학부모 확인·수납까지 연결하기로 방향을 정리했습니다. 핵심 기능을 먼저 개발한 뒤 실제 사용과 피드백을 거쳐 단계적으로 확장합니다.",
    discussion: `주요 기능 영역
학생·수업 통합 관리, 신규 상담과 등록, 출결·보강, 수강료·수납·정산, 작품·강평 아카이브, 관리자 대시보드와 알림, 역할별 권한과 보안, 강사 근태·업무 운영을 검토했습니다.

운영 방향
캠퍼스별 데이터 분리와 통합 현황을 함께 제공하고, 최고관리자·이사·원장/실장·전임·학생/보호자 권한을 구분합니다. 개인정보는 최소화하고 접속 기록과 접근 범위를 제한합니다.

개발·비용
1차 베타 개발 후 시범 운영과 2차 보완을 진행합니다. 개발비 외 서버·저장공간·알림톡·결제 연동·유지보수 비용을 검토하며, 구체 견적은 기능 범위 확정 후 산정합니다.`,
    decisions: `AI 기능 자체보다 반복 업무를 줄이는 학생 중심 통합 운영 구조를 우선합니다.
학생 정보를 한 번 등록한 뒤 상담·등록·반·시간표·출결·작품·수납에 연결합니다.
캠퍼스별 데이터 구분과 역할별 권한을 초기 설계에 포함합니다.
1차 베타→실제 사용→피드백→2차 보완·확장 방식으로 개발합니다.
기존 결제 시스템 유지와 거래 데이터 연동 방식을 직접 결제 기능과 함께 검토합니다.
기존 기획에서 빠졌던 강사 근태·업무·면담·징계 기록을 추가 검토합니다.`,
    actionItems: `다음 개발 미팅 전 캠퍼스별 요구사항 취합
개발자에게 전달할 핵심 기능과 선택·확장 기능 구분
개인정보 저장 범위와 역할별 권한 확정
결제 직접 연동과 기존 시스템 데이터 가져오기 방식 비교
기능 범위 확정 후 개발비와 운영비 견적 확인
10월 2일 전후 1차 프로토타입 가능 여부 확인`,
    source: "AI_기반_학원_통합관리_시스템_개발_회의록.html",
    status: "published",
    demo: true,
  },
  {
    id: "meeting-designer-studio-2026-09",
    title: "디자이너 채용 및 공동 제작실 운영 회의",
    meetingDate: "2026-09 (일자 미상)",
    organization: "김해·명지·센텀 공동 제작실",
    location: "미기재",
    participants: "참석자 미기재",
    attendeeCount: 0,
    purpose: "공동 제작실에서 근무할 디자이너의 채용 조건과 캠퍼스별 제작 요청·검수·공유 절차, 공동 운영비 분담 방식을 정리합니다.",
    summary: "김해 측에서 검토한 디자이너로 진행하고 10월 1일부터 공동 제작실 운영을 시작하는 방향에 합의했습니다. 기존 세 캠퍼스는 신규 캠퍼스가 추가되기 전까지 월 85만 원씩 비용을 부담하고, 제작 계획과 요청·피드백·원본 공유 절차를 공통으로 운영합니다.",
    discussion: `디자이너 근무 조건
급여는 230만~240만 원 범위에서 협의하며 비용 계산은 240만 원을 기준으로 논의했습니다. 약 3개월간 토요일 오전은 재활 치료로 근무가 어렵고 오후 2시부터 근무 가능합니다.

제작물 운영
월초에 휴무일·공모전·실기대회 결과·정기 홍보물 계획을 밴드에 공유합니다. 캠퍼스별 추가 요청은 밴드로 접수하고, 초안 이후 피드백은 빠른 메신저에서 진행합니다. 최종본은 마이박스에 PNG 미리보기와 일러스트·포토샵 원본을 함께 공유합니다. 큰 제작물은 최소 2개월 전에 준비합니다.

비용과 공동 운영
신규 캠퍼스에는 약 2개월의 비용 유예기간을 두는 안이 논의됐습니다. 신규 캠퍼스 증가 후 분담 방식과 추가 분담금의 공동기금 적립·사용 원칙은 미확정입니다. 디자인 소스 서비스와 장비·어도비 구독 비용도 검토했습니다.`,
    decisions: `김해 측에서 검토한 디자이너로 진행하는 방향에 합의했습니다.
채용·공동 제작실 운영 시작일은 10월 1일로 정했습니다.
신규 캠퍼스 추가 전까지 김해·명지·센텀은 월 85만 원씩 부담합니다.
제작 요청 시 필수 문구, 규격, 분위기, 완료 희망일, 참고자료를 함께 전달합니다.
오탈자·날짜·전화번호·주소는 최종 확정 전 각 캠퍼스가 함께 검수합니다.`,
    actionItems: `디자이너 급여·근무시간·세부 조건 최종 협의 후 공유
캠퍼스별 장기 비용 분담안을 제안하고 토요일까지 의견 취합 후 투표
추가 분담금 적립 시 공동기금 사용 원칙 수립
도입 검토 중인 디자인 소스 서비스의 정확한 명칭과 견적 확인
파트별 단체방에 회의 자료와 안건을 사전 공유`,
    source: "디자이너_채용_및_공동제작실_운영회의_요약_전체대본.html",
    status: "published",
    demo: true,
  },
];

const demoEventTagMap: Record<string, string[]> = {
  "tongjin-middle-school-career-mentoring-2026": ["진로멘토링", "학교연계", "웹툰", "중학생"],
  "gurae-scholarship-awards-2026": ["장학시상", "학생관리", "실기우수", "예비반"],
  "sau-pre-admission-counseling-2026": ["학부모간담회", "진학상담", "입시설명", "예비반"],
  "sau-design-admissions-briefing-2026": ["입시설명회", "학부모간담회", "디자인", "미대입시"],
  "geomdan-art-exhibition-2026": ["작품전시", "학생작품", "캠퍼스행사"],
  "demo-family-month-2025": ["가정의달", "체험행사", "신입생"],
  "demo-open-class-2025": ["공개수업", "학부모", "수업체험"],
  "demo-creative-day-2025": ["창작체험", "신입생", "캠퍼스행사"],
};

const demoMeetingTagMap: Record<string, string[]> = {
  "meeting-design-practical-2026-09-23": ["디자인실기", "실기대회", "수상작분석", "공동품평"],
  "meeting-animation-part-2026-09-17": ["애니", "연합시험", "커리큘럼", "스타일통일", "실기연구", "입시연계"],
  "meeting-elementary-part-2026-09-17": ["초중등", "커리큘럼", "공모전", "재등록관리", "학생관리", "휴퇴원방어"],
  "meeting-academy-system-2026-09-09": ["AI통합관리", "시스템개발", "업무효율화"],
  "meeting-designer-studio-2026-09": ["디자이너채용", "공동제작실", "운영회의"],
};

type TagStat = { name: string; count: number; lastUsedAt?: string };

function recordTags(record: EventRecord | MeetingNote) {
  if (record.tags?.length) return record.tags;
  return "startDate" in record ? demoEventTagMap[record.id] ?? [] : demoMeetingTagMap[record.id] ?? [];
}

function tagStats(records: Array<EventRecord | MeetingNote>): TagStat[] {
  const counts = new Map<string, number>();
  records.forEach((record) => recordTags(record).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
}

const won = new Intl.NumberFormat("ko-KR");

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
          execute: (input: unknown) => unknown | Promise<unknown>;
        },
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

export default function Home() {
  const [role, setRole] = useState<Role | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [section, setSection] = useState<Section>("events");
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("all");
  const [target, setTarget] = useState("all");
  const [budget, setBudget] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [popularTags, setPopularTags] = useState<TagStat[]>([]);
  const [events, setEvents] = useState<EventRecord[]>(demoEvents);
  const [assets, setAssets] = useState<MarketingAsset[]>(demoAssets);
  const [meetings, setMeetings] = useState<MeetingNote[]>(demoMeetings);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<MarketingAsset | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingNote | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => (await response.json()) as { role?: Role | null; demo?: boolean })
      .then((data) => {
        setRole(data.role ?? null);
        setDemoMode(Boolean(data.demo));
      })
      .catch(() => setRole(null))
      .finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    if (!role) return;
    if (section !== "events" && section !== "marketing" && section !== "meetings") {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (branch !== "all") params.set(section === "meetings" ? "organization" : "branch", branch);
      if (target !== "all" && section !== "meetings") params.set(section === "events" ? "audience" : "target", target);
      if (section === "events" && budget !== "all") params.set("budget", budget);
      if ((section === "events" || section === "meetings") && selectedTags.length) params.set("tags", selectedTags.join(","));
      try {
        const response = await fetch(`/api/${section}?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          setRole(null);
          return;
        }
        if (!response.ok) throw new Error("archive unavailable");
        const data = await response.json() as { events?: EventRecord[]; assets?: MarketingAsset[]; meetings?: MeetingNote[] };
        if (section === "events") setEvents([...(data.events ?? []), ...filterDemoEvents(query, branch, target, budget, selectedTags)]);
        else if (section === "marketing") setAssets([...(data.assets ?? []), ...filterDemoAssets(query, branch, target)]);
        else setMeetings([...(data.meetings ?? []), ...filterDemoMeetings(query, selectedTags)]);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          if (section === "events") setEvents(filterDemoEvents(query, branch, target, budget, selectedTags));
          else if (section === "marketing") setAssets(filterDemoAssets(query, branch, target));
          else setMeetings(filterDemoMeetings(query, selectedTags));
        }
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [branch, budget, query, reloadToken, role, section, selectedTags, target]);

  useEffect(() => {
    if (!role || (section !== "events" && section !== "meetings")) {
      setPopularTags([]);
      return;
    }
    const demo = tagStats(section === "events" ? demoEvents : demoMeetings);
    fetch(`/api/tags?scope=${section}`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ tags?: TagStat[] }> : { tags: [] })
      .then((data) => {
        const merged = new Map<string, TagStat>();
        [...(data.tags ?? []), ...demo].forEach((tag) => {
          const current = merged.get(tag.name);
          merged.set(tag.name, { name: tag.name, count: (current?.count ?? 0) + tag.count, lastUsedAt: tag.lastUsedAt ?? current?.lastUsedAt });
        });
        setPopularTags([...merged.values()].sort((a, b) => b.count - a.count || (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") || a.name.localeCompare(b.name, "ko")));
      })
      .catch(() => setPopularTags(demo));
  }, [reloadToken, role, section]);

  useEffect(() => {
    if (!role || !document.modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = document.modelContext.registerTool(
      {
        name: "search_archive",
        title: "아카이브 검색",
        description: "이벤트, 마케팅 제작물 또는 회의록 아카이브 화면에 검색 조건을 적용합니다.",
        inputSchema: {
          type: "object",
          properties: {
            archive: { type: "string", enum: ["events", "marketing", "meetings"] },
            query: { type: "string", maxLength: 100 },
            branch: { type: "string", maxLength: 80 },
            target: { type: "string", maxLength: 80 },
          },
          required: ["archive"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute(input) {
          const value = input as { archive?: unknown; query?: unknown; branch?: unknown; target?: unknown };
          if (value.archive !== "events" && value.archive !== "marketing" && value.archive !== "meetings") throw new Error("archive must be events, marketing or meetings");
          if (value.query !== undefined && typeof value.query !== "string") throw new Error("query must be a string");
          if (value.branch !== undefined && typeof value.branch !== "string") throw new Error("branch must be a string");
          if (value.target !== undefined && typeof value.target !== "string") throw new Error("target must be a string");
          setSection(value.archive);
          setQuery(value.query?.trim() ?? "");
          setBranch(value.branch?.trim() || "all");
          setTarget(value.target?.trim() || "all");
          setBudget("all");
          setSelectedTags([]);
          return { archive: value.archive, filtersApplied: true };
        },
      },
      { signal: lifecycle.signal },
    );
    Promise.resolve(register).catch(() => undefined);
    return () => lifecycle.abort();
  }, [role]);

  const me = role ? getMe() : null;

  // #admin 주소로 들어오면 관리자에게 회원 관리 화면을 연다
  useEffect(() => {
    if (role === "admin" && location.hash === "#admin") setSection("members");
    if (role !== "admin" && section === "members") setSection("events");
    if (section === "fund" && getMe()?.title !== "원장") setSection("events");
  }, [role, section]);

  // 이미지 우클릭·드래그 저장 방지 (상세 팝업 포함)
  useEffect(() => {
    if (!role) return;
    const block = (event: Event) => { if ((event.target as HTMLElement | null)?.tagName === "IMG") event.preventDefault(); };
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    return () => { document.removeEventListener("contextmenu", block); document.removeEventListener("dragstart", block); };
  }, [role]);

  // 접속·열람 기록 (2분마다 접속 신호)
  useEffect(() => {
    if (!role) return;
    const ping = (body: Record<string, string> = {}) => fetch("/api/ping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => undefined);
    const timer = window.setInterval(() => void ping(), 120000);
    return () => window.clearInterval(timer);
  }, [role]);
  useEffect(() => {
    if (!role) return;
    void fetch("/api/ping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: section, kind: "view" }) }).catch(() => undefined);
  }, [role, section]);
  useEffect(() => {
    const opened = selectedEvent?.title ?? selectedAsset?.title ?? selectedMeeting?.title;
    if (!role || !opened) return;
    void fetch("/api/ping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: opened, kind: "open" }) }).catch(() => undefined);
  }, [role, selectedEvent, selectedAsset, selectedMeeting]);

  const relatedTitles = useMemo(() => new Map(events.map((event) => [event.id, event.title])), [events]);
  const sectionLabel = section === "members" ? "회원 관리" : section === "events" ? "이벤트" : section === "promotions" ? "홍보" : section === "requests" ? "제작 요청" : section === "marketing" ? "마케팅 제작물" : section === "meetings" ? "회의록" : section === "compliance" ? "연간 이수 관리" : "제작실 기금";
  const sectionHeading = section === "members" ? "회원 관리" : section === "events" ? "지점별 이벤트 기록" : section === "promotions" ? "홍보 활동 기록과 통계" : section === "requests" ? "제작 요청" : section === "marketing" ? "마케팅 디자인 아카이브" : section === "meetings" ? "회의록 아카이브" : section === "compliance" ? "연간 이수 관리" : "제작실 기금";
  const sectionDescription = section === "members" ? "가입 신청 승인, 직책·관리자 지정, 접속·열람 기록을 관리하세요." : section === "events" ? "대상, 날짜, 예산으로 필요한 행사 사례를 빠르게 찾아보세요." : section === "promotions" ? "센텀·김해·명지 캠퍼스의 홍보 기록과 실적을 한눈에 비교하세요." : section === "requests" ? "캠퍼스 요청부터 승인, 제작 진행, 완료까지 한곳에서 관리하세요." : section === "marketing" ? "완성된 제작물과 원본 파일을 찾아 다음 캠페인에 재활용하세요." : section === "meetings" ? "파트별 회의 안건과 합의사항, 후속 업무를 한곳에서 확인하세요." : section === "compliance" ? "캠퍼스별 필수 이수 현황과 이수증 등록 여부를 관리하세요." : "원장만 열람할 수 있는 제작실 공동기금 내역입니다.";
  const resultCount = section === "events" ? events.length : section === "marketing" ? assets.length : section === "meetings" ? meetings.length : null;

  function changeSection(next: Section) {
    setSection(next);
    try { history.replaceState(null, "", next === "members" ? "#admin" : location.pathname + location.search); } catch { /* 무시 */ }
    resetFilters();
  }

  function resetFilters() {
    setQuery("");
    setBranch("all");
    setTarget("all");
    setBudget("all");
    setSelectedTags([]);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setRole(null);
    toast.success("로그아웃되었습니다.");
  }

  async function updateStatus(kind: ArchiveSection, id: string, status: PublishStatus) {
    const response = await fetch(`/api/${kind}/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return toast.error("공개 상태를 변경하지 못했습니다.");
    toast.success(status === "published" ? "직원에게 공개했습니다." : "비공개 초안으로 전환했습니다.");
    setReloadToken((value) => value + 1);
  }

  async function deleteRecord(kind: ArchiveSection, id: string) {
    if (!window.confirm("이 기록을 삭제할까요? 삭제 후 복구할 수 없습니다.")) return;
    const response = await fetch(`/api/${kind}/${id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("기록을 삭제하지 못했습니다.");
    toast.success("기록을 삭제했습니다.");
    setReloadToken((value) => value + 1);
  }

  if (!sessionChecked) return <FullScreenLoading />;
  if (!role) return <LoginGate onLogin={setRole} />;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="grid h-11 w-14 shrink-0 place-items-center rounded-lg bg-white p-1 ring-1 ring-border/60">
              <Image src="./hi5-logo.webp" alt="Hi5" width={104} height={64} className="h-full w-full object-contain" priority />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold tracking-tight">하이파이브미술학원</p>
              <p className="truncate text-[13px] text-muted-foreground">행정마케팅파트</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>아카이브</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={section === "events"} tooltip="이벤트" onClick={() => changeSection("events")}>
                    <LayoutGrid aria-hidden="true" /><span>이벤트</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={section === "promotions"} tooltip="홍보" onClick={() => changeSection("promotions")}>
                    <Megaphone aria-hidden="true" /><span>홍보</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={section === "requests"} tooltip="제작 요청" onClick={() => changeSection("requests")}>
                    <ClipboardList aria-hidden="true" /><span>제작 요청</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={section === "marketing"} tooltip="마케팅 제작물" onClick={() => changeSection("marketing")}>
                    <PanelsTopLeft aria-hidden="true" /><span>마케팅 제작물</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={section === "meetings"} tooltip="회의록" onClick={() => changeSection("meetings")}>
                    <NotebookTabs aria-hidden="true" /><span>회의록</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={section === "compliance"} tooltip="연간 이수 관리" onClick={() => changeSection("compliance")}>
                    <FileCheck2 aria-hidden="true" /><span>연간 이수 관리</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {me?.title === "원장" && (
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={section === "fund"} tooltip="제작실 기금" onClick={() => changeSection("fund")}>
                    <LockKeyhole aria-hidden="true" /><span>제작실 기금</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {role === "admin" && (
            <SidebarGroup>
              <SidebarGroupLabel>본사 관리</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="새 자료 등록" onClick={() => { setSection("events"); setEditorOpen(true); }}>
                      <Plus aria-hidden="true" /><span>새 자료 등록</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={section === "members"} tooltip="회원 관리" onClick={() => changeSection("members")}>
                      <UserCog aria-hidden="true" /><span>회원 관리</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter className="p-3">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent p-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              {role === "admin" ? <ShieldCheck className="size-4" /> : <KeyRound className="size-4" />}
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{me ? `${me.name} ${me.title}` : "교직원"}</p>
              <p className="truncate text-[13px] text-sidebar-foreground/60">{me ? `${me.campus}캠퍼스 · ${role === "admin" ? "관리자" : "교직원"}` : ""}</p>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem><SidebarMenuButton tooltip="로그아웃" onClick={logout}><LogOut /><span>로그아웃</span></SidebarMenuButton></SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-[var(--archive-canvas)]">
        {me && <Watermark text={`${me.campus} ${me.name} · ${new Date().toISOString().slice(0, 10)}`} />}
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl md:px-7">
          <div className="flex items-center gap-2 text-sm"><SidebarTrigger className="size-8 md:hidden" /><span className="hidden text-muted-foreground sm:inline">아카이브</span><span className="hidden text-muted-foreground/50 sm:inline">/</span><h2 className="font-medium">{sectionLabel}</h2></div>
          <div className="flex items-center gap-2">
            {(role === "admin" || (demoMode && section === "marketing")) && (section === "events" || section === "marketing" || section === "meetings") && <Button size="sm" className="rounded-xl" onClick={() => setEditorOpen(true)}><Plus className="size-4" />새 자료 등록</Button>}
            <Badge variant="secondary" className="hidden gap-1.5 rounded-full px-3 py-1.5 font-medium text-emerald-700 sm:inline-flex dark:text-emerald-300"><Archive className="size-3.5" />{demoMode ? "체험판" : "직원 전용"}</Badge>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1220px] px-4 py-6 md:px-7 md:py-8">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">{sectionHeading}</h1>
              <p className="mt-1.5 text-[15px] text-muted-foreground">{sectionDescription}</p>
            </div>
            {resultCount !== null && <p className="text-sm font-medium text-muted-foreground" aria-live="polite">{loading ? "검색 중…" : `검색 결과 ${resultCount}개`}</p>}
          </div>

          {(section === "events" || section === "marketing" || section === "meetings") && <SearchPanel section={section} query={query} setQuery={setQuery} branch={branch} setBranch={setBranch} target={target} setTarget={setTarget} budget={budget} setBudget={setBudget} onReset={resetFilters} />}
          {(section === "events" || section === "meetings") && (
            <TagFilterPanel
              label={section === "events" ? "이벤트 인기 태그" : "회의록 인기 태그"}
              tags={popularTags}
              selected={selectedTags}
              onToggle={(tag) => setSelectedTags((items) => items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag])}
              onClear={() => setSelectedTags([])}
            />
          )}

          {section === "promotions" ? <PromotionsSection role={role} demoMode={demoMode} /> : section === "requests" ? <ProductionRequestsSection role={role} demoMode={demoMode} onOpenMarketing={() => changeSection("marketing")} /> : section === "compliance" ? <ComplianceSection role={role} demoMode={demoMode} /> : section === "fund" ? <FundSection /> : section === "members" ? <MembersSection /> : section === "events" ? (
            events.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{events.map((event) => <EventCard key={event.id} event={event} role={role} onOpen={setSelectedEvent} onStatus={updateStatus} onDelete={deleteRecord} />)}</div> : <EmptyState onReset={resetFilters} />
          ) : section === "marketing" ? assets.length ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{assets.map((asset) => <MarketingCard key={asset.id} asset={asset} role={role} onOpen={setSelectedAsset} onStatus={updateStatus} onDelete={deleteRecord} />)}</div>
          ) : <EmptyState onReset={resetFilters} /> : meetings.length ? (
            <div className="grid gap-3">{meetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} role={role} onOpen={setSelectedMeeting} onStatus={updateStatus} onDelete={deleteRecord} />)}</div>
          ) : query.trim() ? <EmptyState onReset={resetFilters} /> : <MeetingEmptyState demoMode={demoMode} role={role} onCreate={() => setEditorOpen(true)} />}
        </main>
      </SidebarInset>

      <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      <MarketingDetail asset={selectedAsset} relatedTitle={selectedAsset?.relatedEventId ? relatedTitles.get(selectedAsset.relatedEventId) : undefined} onClose={() => setSelectedAsset(null)} />
      <MeetingDetail meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />
      <Dialog open={editorOpen && (section === "events" || section === "marketing" || section === "meetings")} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{section === "events" ? "이벤트 기록 등록" : section === "marketing" ? "마케팅 제작물 등록" : "회의록 등록"}</DialogTitle>
            <DialogDescription>{section === "meetings" ? "기존 회의록 내용을 정리해 입력한 뒤 초안으로 저장하세요." : "밴드 게시물의 핵심 내용을 정리한 뒤 초안 저장 또는 즉시 공개하세요."}</DialogDescription>
          </DialogHeader>
          {section === "events" ? (
            <EventForm saving={saving} setSaving={setSaving} onSaved={() => { setEditorOpen(false); setReloadToken((value) => value + 1); }} />
          ) : section === "marketing" ? (
            <MarketingForm events={events.filter((event) => !event.demo)} saving={saving} setSaving={setSaving} demoMode={demoMode} onSaved={(asset) => { setEditorOpen(false); if (asset) setAssets((items) => [asset, ...items]); else setReloadToken((value) => value + 1); }} />
          ) : (
            <MeetingForm saving={saving} setSaving={setSaving} onSaved={() => { setEditorOpen(false); setReloadToken((value) => value + 1); }} />
          )}
        </DialogContent>
      </Dialog>
      <Toaster richColors position="top-center" />
    </SidebarProvider>
  );
}

function Watermark({ text }: { text: string }) {
  return <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] grid select-none grid-cols-3 content-around gap-y-24 overflow-hidden opacity-[0.07] print:opacity-20">{Array.from({ length: 18 }, (_, index) => <span key={index} className="-rotate-[24deg] whitespace-nowrap text-center text-sm font-semibold text-foreground">{text}</span>)}</div>;
}

function SearchPanel(props: {
  section: Section;
  query: string;
  setQuery: (value: string) => void;
  branch: string;
  setBranch: (value: string) => void;
  target: string;
  setTarget: (value: string) => void;
  budget: string;
  setBudget: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="mb-7 rounded-2xl border border-border/80 bg-card p-3 shadow-[0_10px_35px_rgba(38,33,28,0.06)] md:p-4">
      <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder={props.section === "events" ? "이벤트명, 진행 내용, 지점 검색" : props.section === "marketing" ? "제작물명, 채널, 캠페인 검색" : "회의 제목, 참석자, 결정사항 검색"} className="h-11 rounded-xl bg-[var(--archive-canvas)] pl-11 text-base shadow-none" aria-label="검색어" /></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {props.section !== "meetings" && <Select value={props.branch} onValueChange={props.setBranch}><SelectTrigger className="h-10 min-w-32 rounded-xl bg-background"><SelectValue placeholder="전체 지점" /></SelectTrigger><SelectContent><SelectItem value="all">전체 지점</SelectItem><SelectItem value="검단캠퍼스">검단캠퍼스</SelectItem><SelectItem value="김포·검단 공동">김포·검단 공동</SelectItem><SelectItem value="사우캠퍼스">사우캠퍼스</SelectItem><SelectItem value="김포캠퍼스">김포캠퍼스</SelectItem><SelectItem value="운양캠퍼스">운양캠퍼스</SelectItem><SelectItem value="부산캠퍼스">부산캠퍼스</SelectItem><SelectItem value="김해캠퍼스">김해캠퍼스</SelectItem><SelectItem value="본사 공통">본사 공통</SelectItem></SelectContent></Select>}
        {props.section !== "meetings" && <Select value={props.target} onValueChange={props.setTarget}><SelectTrigger className="h-10 min-w-32 rounded-xl bg-background"><SelectValue placeholder="전체 대상" /></SelectTrigger><SelectContent><SelectItem value="all">전체 대상</SelectItem><SelectItem value="신입생">신입생</SelectItem><SelectItem value="입시생">입시생</SelectItem><SelectItem value="학생">학생</SelectItem><SelectItem value="학부모">학부모</SelectItem><SelectItem value="재원생">재원생</SelectItem><SelectItem value="외부 방문객">외부 방문객</SelectItem><SelectItem value="전체">전체</SelectItem></SelectContent></Select>}
        {props.section === "events" && <Select value={props.budget} onValueChange={props.setBudget}><SelectTrigger className="h-10 min-w-36 rounded-xl bg-background"><SelectValue placeholder="전체 예산" /></SelectTrigger><SelectContent><SelectItem value="all">전체 예산</SelectItem><SelectItem value="under50">50만원 이하</SelectItem><SelectItem value="over50">50만원 초과</SelectItem></SelectContent></Select>}
        <Button variant="ghost" className="ml-auto h-10 rounded-xl text-muted-foreground" onClick={props.onReset}>필터 초기화</Button>
      </div>
    </div>
  );
}

function TagFilterPanel({ label, tags, selected, onToggle, onClear }: { label: string; tags: TagStat[]; selected: string[]; onToggle: (tag: string) => void; onClear: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const visible = expanded ? tags : tags.slice(0, 12);
  if (!tags.length) return null;
  return (
    <div className="mb-6 -mt-3 rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-[0_10px_35px_rgba(38,33,28,0.05)] md:py-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="flex items-center gap-2 text-left md:pointer-events-none" onClick={() => setMobileOpen((value) => !value)} aria-expanded={mobileOpen}><Hash className="size-4 text-brand" /><h2 className="text-sm font-semibold">{label}</h2>{selected.length > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">{selected.length}개 선택</span>}<ChevronDown className={`size-4 text-muted-foreground transition md:hidden ${mobileOpen ? "rotate-180" : ""}`} /></button>
        {selected.length > 0 && <Button variant="ghost" size="sm" className="h-8 rounded-full text-muted-foreground" onClick={onClear}>선택 해제</Button>}
      </div>
      <div className={`mt-3 flex-wrap gap-2 ${mobileOpen ? "flex" : "hidden md:flex"}`}>
        {visible.map((tag) => <Button key={tag.name} type="button" size="sm" variant={selected.includes(tag.name) ? "default" : "outline"} className="h-9 rounded-full px-3" onClick={() => onToggle(tag.name)}>#{tag.name}<span className={selected.includes(tag.name) ? "text-primary-foreground/75" : "text-muted-foreground"}>{tag.count}</span></Button>)}
        {tags.length > 12 && <Button type="button" size="sm" variant="ghost" className="h-9 rounded-full" onClick={() => setExpanded((value) => !value)}>{expanded ? "간단히" : `전체 ${tags.length}개 보기`}</Button>}
      </div>
      {selected.length > 1 && <p className="mt-3 text-xs text-muted-foreground">선택한 태그를 모두 포함한 기록만 표시합니다.</p>}
    </div>
  );
}

function EventCard({ event, role, onOpen, onStatus, onDelete }: { event: EventRecord; role: Role; onOpen: (event: EventRecord) => void; onStatus: (kind: ArchiveSection, id: string, status: PublishStatus) => void; onDelete: (kind: ArchiveSection, id: string) => void }) {
  return (
    <Card className="group overflow-hidden rounded-2xl border-border/80 py-0 shadow-[0_8px_24px_rgba(38,33,28,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(38,33,28,0.12)]">
      <button type="button" className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset" onClick={() => onOpen(event)} aria-label={`${event.title} 크게 보기`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--archive-image-fallback)]">
          {event.imageUrl ? <Image src={event.imageUrl} alt={`${event.title} 행사 이미지`} fill unoptimized className="object-cover object-center transition duration-300 group-hover:scale-[1.035]" sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw" /> : <NoImageArt branch={event.branch} kicker={event.eventType} />}
          <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-background/90 text-foreground opacity-90 shadow-sm backdrop-blur transition group-hover:scale-105" aria-hidden="true"><ZoomIn className="size-4" /></span>
          {event.status === "draft" && <Badge variant="secondary" className="absolute left-3 top-3 rounded-full">초안</Badge>}
        </div>
        <CardContent className="p-3.5 md:p-4"><h3 className="line-clamp-2 min-h-12 text-[15px] font-semibold leading-6 md:text-base">{event.title}</h3><p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><CampusDot branch={event.branch} /><span className="truncate">{campusShort(event.branch)} · {formatPeriod(event.startDate, event.endDate)}</span></p></CardContent>
      </button>
      {role === "admin" && !event.demo && <div className="px-4 pb-4"><AdminActions status={event.status} onStatus={(status) => onStatus("events", event.id, status)} onDelete={() => onDelete("events", event.id)} /></div>}
    </Card>
  );
}

function MarketingCard({ asset, role, onOpen, onStatus, onDelete }: { asset: MarketingAsset; role: Role; onOpen: (asset: MarketingAsset) => void; onStatus: (kind: ArchiveSection, id: string, status: PublishStatus) => void; onDelete: (kind: ArchiveSection, id: string) => void }) {
  return (
    <Card className="group overflow-hidden rounded-2xl border-border/80 py-0 shadow-[0_8px_24px_rgba(38,33,28,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(38,33,28,0.12)]">
      <button type="button" className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset" onClick={() => onOpen(asset)} aria-label={`${asset.title} 크게 보기`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--archive-panel)] p-3">
          {asset.previewUrl ? <div className="relative h-full overflow-hidden rounded-xl bg-white/80"><Image src={asset.previewUrl} alt={`${asset.title} 미리보기`} fill unoptimized style={{ objectFit: "contain" }} className="object-contain object-center transition duration-300 group-hover:scale-[1.025]" /></div> : <div className={`marketing-art marketing-art-card ${asset.className ?? "marketing-art-one"}`}><span className="marketing-art-canvas">{asset.channel || asset.assetType}</span><span className="marketing-art-kicker">{asset.kicker ?? asset.assetType.toUpperCase()}</span><strong>{asset.headline ?? asset.title}</strong><span className="marketing-art-caption">{asset.branch}</span></div>}
          <span className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-background/90 text-foreground opacity-90 shadow-sm backdrop-blur transition group-hover:scale-105" aria-hidden="true"><ZoomIn className="size-4" /></span>
          {(asset.galleryImages?.length ?? 0) > 1 && <span className="absolute bottom-5 right-5 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur" aria-hidden="true"><Images className="size-3.5" />{asset.galleryImages?.length}장</span>}
          {asset.status === "draft" && <Badge variant="secondary" className="absolute left-5 top-5 rounded-full">초안</Badge>}
        </div>
        <CardContent className="p-3.5 md:p-4"><h3 className="line-clamp-2 min-h-12 text-[15px] font-semibold leading-6 md:text-base">{asset.title}</h3><p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><CampusDot branch={asset.branch} /><span className="truncate">{campusShort(asset.branch)} · {asset.assetType} · {asset.createdDate.replaceAll("-", ".")}</span></p></CardContent>
      </button>
      {role === "admin" && !asset.demo && <div className="px-4 pb-4"><AdminActions status={asset.status} onStatus={(status) => onStatus("marketing", asset.id, status)} onDelete={() => onDelete("marketing", asset.id)} /></div>}
    </Card>
  );
}

function MeetingCard({ meeting, role, onOpen, onStatus, onDelete }: { meeting: MeetingNote; role: Role; onOpen: (meeting: MeetingNote) => void; onStatus: (kind: ArchiveSection, id: string, status: PublishStatus) => void; onDelete: (kind: ArchiveSection, id: string) => void }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/80 py-0 shadow-[0_8px_24px_rgba(38,33,28,0.05)]">
      <button type="button" className="grid w-full gap-4 p-5 text-left transition hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:grid-cols-[120px_1fr_auto] sm:items-center" onClick={() => onOpen(meeting)}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground sm:block">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary sm:mb-3"><NotebookTabs className="size-5" /></div>
          <span>{formatPeriod(meeting.meetingDate, null)}</span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold md:text-[17px]">{meeting.title}</h3>
            {meeting.status === "draft" && <Badge variant="secondary" className="rounded-full">초안</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">{meeting.organization && <CampusDot branch={meeting.organization} />}{[meeting.organization, meeting.location].filter(Boolean).join(" · ") || "지점·장소 미입력"}</p>
          <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{meeting.summary || meeting.purpose || "요약이 입력되지 않았습니다."}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground sm:justify-end">
          <span className="rounded-full bg-muted px-3 py-1.5">결정 {countLines(meeting.decisions)}건</span>
          <span className="rounded-full bg-muted px-3 py-1.5">후속 업무 {countLines(meeting.actionItems)}건</span>
        </div>
      </button>
      {role === "admin" && !meeting.demo && <div className="px-5 pb-4"><AdminActions status={meeting.status} onStatus={(status) => onStatus("meetings", meeting.id, status)} onDelete={() => onDelete("meetings", meeting.id)} /></div>}
    </Card>
  );
}

function NoImageArt({ branch, kicker }: { branch: string; kicker?: string }) {
  const color = campusColor(branch);
  return <div className="flex h-full flex-col justify-between p-4" style={{ background: `linear-gradient(150deg, ${color}26 0%, ${color}0d 100%)` }}><span className="w-fit rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium" style={{ color }}><CampusLabel branch={branch} /></span><div><Images className="mb-2 size-5 opacity-60" style={{ color }} /><p className="text-lg font-bold leading-tight tracking-tight md:text-xl" style={{ color }}>{kicker || "행사 기록"}</p><p className="mt-1 text-xs text-muted-foreground">사진 미등록</p></div></div>;
}

function AdminActions({ status, onStatus, onDelete }: { status: PublishStatus; onStatus: (status: PublishStatus) => void; onDelete: () => void }) {
  return <div className="mt-3 flex gap-2 border-t pt-3"><Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => onStatus(status === "published" ? "draft" : "published")}>{status === "published" ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{status === "published" ? "비공개" : "직원 공개"}</Button><Button size="icon-sm" variant="ghost" className="rounded-xl text-destructive" onClick={onDelete} aria-label="삭제"><Trash2 className="size-4" /></Button></div>;
}

function EventDetail({ event, onClose }: { event: EventRecord | null; onClose: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const photos = useMemo<EventImage[]>(() => {
    if (!event) return [];
    if (event.galleryImages?.length) return event.galleryImages;
    return event.imageUrl ? [{ src: event.imageUrl, alt: `${event.title} 행사 이미지`, caption: "행사 사진" }] : [];
  }, [event]);
  const activePhoto = photos[photoIndex] ?? null;

  useEffect(() => {
    setPhotoIndex(0);
    setFullscreen(false);
  }, [event?.id]);

  useEffect(() => {
    if (!fullscreen || photos.length < 2) return;
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "ArrowLeft") setPhotoIndex((current) => (current - 1 + photos.length) % photos.length);
      if (keyboardEvent.key === "ArrowRight") setPhotoIndex((current) => (current + 1) % photos.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreen, photos.length]);

  const showPrevious = () => setPhotoIndex((current) => (current - 1 + photos.length) % photos.length);
  const showNext = () => setPhotoIndex((current) => (current + 1) % photos.length);

  return (
    <>
      <Dialog open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-6xl lg:grid lg:h-[86dvh] lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)] lg:overflow-hidden">
          {event && <>
            <div className="flex min-h-[50vh] min-w-0 flex-col overflow-hidden rounded-t-2xl bg-[#0d0f16] lg:min-h-0 lg:rounded-l-2xl lg:rounded-tr-none">
              <div className="relative min-h-0 flex-1 overflow-hidden">
                {activePhoto ? <button type="button" className="relative block h-full min-h-[360px] w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white lg:min-h-0" onClick={() => setFullscreen(true)} aria-label="사진 전체화면으로 보기"><Image src={activePhoto.src} alt={activePhoto.alt} fill unoptimized style={{ objectFit: "contain" }} className="object-contain object-center p-4 md:p-7" sizes="(min-width: 1024px) 62vw, 92vw" /><span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-medium text-white backdrop-blur"><Maximize2 className="size-4" />전체화면</span></button> : <div className="grid h-full min-h-[360px] place-items-center text-center text-white/60"><div><FileImage className="mx-auto size-10" /><span className="mt-3 block">이미지가 등록되지 않았습니다.</span></div></div>}
                {photos.length > 1 && <><button type="button" onClick={showPrevious} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur transition hover:bg-black/80" aria-label="이전 사진"><ChevronLeft className="size-6" /></button><button type="button" onClick={showNext} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur transition hover:bg-black/80" aria-label="다음 사진"><ChevronRight className="size-6" /></button></>}
              </div>
              {photos.length > 0 && <div className="border-t border-white/10 bg-black/35 p-3"><div className="mb-2 flex items-center justify-between px-1 text-xs text-white/70"><span>{activePhoto?.caption}</span><span>{photoIndex + 1} / {photos.length}</span></div><div className="flex gap-2 overflow-x-auto pb-1">{photos.map((photo, index) => <button type="button" key={`${photo.src}-${index}`} onClick={() => setPhotoIndex(index)} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${index === photoIndex ? "border-white" : "border-transparent opacity-55 hover:opacity-90"}`} aria-label={`${index + 1}번 사진 보기`} aria-current={index === photoIndex ? "true" : undefined}><Image src={photo.src} alt="" fill unoptimized className="object-cover object-center" sizes="96px" /></button>)}</div></div>}
            </div>
            <div className="overflow-y-auto p-6 md:p-8"><DialogHeader className="text-center"><DialogDescription>{event.branch} · {formatPeriod(event.startDate, event.endDate)}</DialogDescription><DialogTitle className="px-5 text-center text-2xl leading-9">{event.title}</DialogTitle></DialogHeader><RecordTagBadges tags={recordTags(event)} /><div className="mt-5 grid grid-cols-2 gap-3"><DetailStat icon={CalendarDays} label="행사 기간" value={formatPeriod(event.startDate, event.endDate)} /><DetailStat icon={Users} label="참여 인원" value={`${event.participantCount}명`} /><DetailStat icon={Wallet} label="총예산" value={event.budget !== null ? `${won.format(event.budget)}원` : "미입력"} /><DetailStat icon={Sparkles} label="이벤트 유형" value={event.eventType} /></div><DetailSection title="행사 개요"><p>{event.summary || "입력된 내용이 없습니다."}</p>{event.venue && <p className="mt-2 text-sm">장소 · {event.venue}</p>}</DetailSection>{event.programs.length > 0 && <DetailSection title="세부 프로그램"><div className="grid gap-3">{event.programs.map((program, index) => <div key={program.id ?? `${program.name}-${index}`} className="rounded-xl bg-muted/60 p-4"><strong className="text-sm">{program.name}</strong><p className="mt-1 text-sm">{program.description}</p><p className="mt-2 text-xs text-muted-foreground">{[program.audience, program.schedule, program.instructors].filter(Boolean).join(" · ")}</p></div>)}</div></DetailSection>}{event.preparation && <DetailSection title="준비사항"><p>{event.preparation}</p></DetailSection>}<DetailSection title="후기와 개선점"><p>{event.review || "입력된 후기가 없습니다."}</p></DetailSection>{(event.sourceAuthor || event.sourceDate || event.sourceUrl) && <DetailSection title="원문 정보"><p>{[event.sourceAuthor, event.sourceDate].filter(Boolean).join(" · ")}</p>{event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-primary underline underline-offset-4">밴드 원문 열기</a>}</DetailSection>}</div>
          </>}
        </DialogContent>
      </Dialog>
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent showCloseButton={false} className="h-[100dvh] w-screen max-w-none gap-0 rounded-none border-0 bg-black p-0 text-white shadow-none sm:max-w-none">
          <DialogTitle className="sr-only">{event?.title} 사진 전체화면</DialogTitle>
          {activePhoto && <div className="relative h-full w-full"><Image src={activePhoto.src} alt={activePhoto.alt} fill unoptimized style={{ objectFit: "contain" }} className="object-contain object-center p-4 md:p-8" sizes="100vw" /><button type="button" onClick={() => setFullscreen(false)} className="absolute right-5 top-5 grid size-11 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-white/20" aria-label="전체화면 닫기"><span aria-hidden="true" className="text-2xl leading-none">×</span></button>{photos.length > 1 && <><button type="button" onClick={showPrevious} className="absolute left-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-white/20" aria-label="이전 사진"><ChevronLeft className="size-7" /></button><button type="button" onClick={showNext} className="absolute right-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-white/20" aria-label="다음 사진"><ChevronRight className="size-7" /></button></>}<div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/65 px-4 py-2 text-sm backdrop-blur"><span>{activePhoto.caption}</span><span className="text-white/55">{photoIndex + 1} / {photos.length}</span></div></div>}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MarketingDetail({ asset, relatedTitle, onClose }: { asset: MarketingAsset | null; relatedTitle?: string; onClose: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const photos = useMemo<EventImage[]>(() => {
    if (!asset) return [];
    if (asset.galleryImages?.length) return asset.galleryImages;
    return asset.previewUrl ? [{ src: asset.previewUrl, alt: `${asset.title} 확대 미리보기`, caption: asset.title }] : [];
  }, [asset]);
  const activePhoto = photos[photoIndex] ?? null;

  useEffect(() => {
    setPhotoIndex(0);
    setFullscreen(false);
  }, [asset?.id]);

  useEffect(() => {
    if (!fullscreen || photos.length < 2) return;
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "ArrowLeft") setPhotoIndex((current) => (current - 1 + photos.length) % photos.length);
      if (keyboardEvent.key === "ArrowRight") setPhotoIndex((current) => (current + 1) % photos.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreen, photos.length]);

  const showPrevious = () => setPhotoIndex((current) => (current - 1 + photos.length) % photos.length);
  const showNext = () => setPhotoIndex((current) => (current + 1) % photos.length);

  return (
    <>
      <Dialog open={Boolean(asset)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-6xl lg:grid lg:h-[86dvh] lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)] lg:overflow-hidden">
          {asset && <>
            <div className="flex min-h-[50vh] min-w-0 flex-col overflow-hidden rounded-t-2xl bg-[#0d0f16] lg:min-h-0 lg:rounded-l-2xl lg:rounded-tr-none">
              <div className="relative min-h-0 flex-1 overflow-hidden">
                {activePhoto ? <button type="button" className="relative block h-full min-h-[360px] w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white lg:min-h-0" onClick={() => setFullscreen(true)} aria-label="제작물 전체화면으로 보기"><Image src={activePhoto.src} alt={activePhoto.alt} fill unoptimized style={{ objectFit: "contain" }} className="object-contain object-center p-4 md:p-7" sizes="(min-width: 1024px) 62vw, 92vw" /><span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-medium text-white backdrop-blur"><Maximize2 className="size-4" />전체화면</span></button> : <div className="grid h-full min-h-[360px] place-items-center p-5"><div className={`marketing-art marketing-art-preview w-full max-w-xl ${asset.className ?? "marketing-art-one"}`}><span className="marketing-art-canvas">{asset.channel || asset.assetType}</span><span className="marketing-art-kicker">{asset.kicker ?? asset.assetType.toUpperCase()}</span><strong>{asset.headline ?? asset.title}</strong><span className="marketing-art-caption">{asset.branch}</span></div></div>}
                {photos.length > 1 && <><button type="button" onClick={showPrevious} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur transition hover:bg-black/80" aria-label="이전 제작물"><ChevronLeft className="size-6" /></button><button type="button" onClick={showNext} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur transition hover:bg-black/80" aria-label="다음 제작물"><ChevronRight className="size-6" /></button></>}
              </div>
              {photos.length > 0 && <div className="border-t border-white/10 bg-black/35 p-3"><div className="mb-2 flex items-center justify-between px-1 text-xs text-white/70"><span>{activePhoto?.caption}</span><span>{photoIndex + 1} / {photos.length}</span></div><div className="flex gap-2 overflow-x-auto pb-1">{photos.map((photo, index) => <button type="button" key={`${photo.src}-${index}`} onClick={() => setPhotoIndex(index)} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${index === photoIndex ? "border-white" : "border-transparent opacity-55 hover:opacity-90"}`} aria-label={`${index + 1}번 제작물 보기`} aria-current={index === photoIndex ? "true" : undefined}><Image src={photo.src} alt="" fill unoptimized className="object-cover object-center" sizes="96px" /></button>)}</div></div>}
            </div>
            <div className="overflow-y-auto p-6 md:p-8"><DialogHeader className="text-center"><DialogDescription>{asset.branch} · {asset.createdDate}</DialogDescription><DialogTitle className="px-5 text-center text-2xl leading-9">{asset.title}</DialogTitle></DialogHeader><div className="mt-4 flex flex-wrap justify-center gap-2"><Badge variant="secondary" className="rounded-full">{asset.assetType}</Badge><Badge variant="outline" className="rounded-full">{asset.target}</Badge>{asset.channel && <Badge variant="outline" className="rounded-full">{asset.channel}</Badge>}{asset.fileFormat && <Badge variant="outline" className="rounded-full">{asset.fileFormat}</Badge>}</div>{(asset.specifications || asset.quantity) && <DetailSection title="제작 규격"><p>{[asset.specifications, asset.quantity ? `수량 ${asset.quantity}개` : ""].filter(Boolean).join(" · ")}</p></DetailSection>}{asset.notes && <DetailSection title="제작물 메모"><p>{asset.notes}</p></DetailSection>}{relatedTitle && <div className="mt-6 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">관련 이벤트 · {relatedTitle}</div>}<div className="mt-6 flex flex-wrap gap-2">{asset.driveUrl && <Button className="rounded-xl" asChild><a href={asset.driveUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Google Drive에서 보기</a></Button>}{asset.sourceUrl && <Button variant="outline" className="rounded-xl" asChild><a href={asset.sourceUrl}><Download className="size-4" />원본 파일 다운로드</a></Button>}</div></div>
          </>}
        </DialogContent>
      </Dialog>
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent showCloseButton={false} className="h-[100dvh] w-screen max-w-none gap-0 rounded-none border-0 bg-black p-0 text-white shadow-none sm:max-w-none">
          <DialogTitle className="sr-only">{asset?.title} 제작물 전체화면</DialogTitle>
          {activePhoto && <div className="relative h-full w-full"><Image src={activePhoto.src} alt={activePhoto.alt} fill unoptimized style={{ objectFit: "contain" }} className="object-contain object-center p-4 md:p-8" sizes="100vw" /><button type="button" onClick={() => setFullscreen(false)} className="absolute right-5 top-5 grid size-11 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-white/20" aria-label="전체화면 닫기"><span aria-hidden="true" className="text-2xl leading-none">×</span></button>{photos.length > 1 && <><button type="button" onClick={showPrevious} className="absolute left-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-white/20" aria-label="이전 제작물"><ChevronLeft className="size-7" /></button><button type="button" onClick={showNext} className="absolute right-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-white/20" aria-label="다음 제작물"><ChevronRight className="size-7" /></button></>}<div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/65 px-4 py-2 text-sm backdrop-blur"><span>{activePhoto.caption}</span><span className="text-white/55">{photoIndex + 1} / {photos.length}</span></div></div>}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MeetingDetail({ meeting, onClose }: { meeting: MeetingNote | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(meeting)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        {meeting && <>
          <DialogHeader className="text-center">
            <DialogDescription>{[meeting.organization, formatPeriod(meeting.meetingDate, null)].filter(Boolean).join(" · ")}</DialogDescription>
            <DialogTitle className="px-5 text-center text-2xl leading-9">{meeting.title}</DialogTitle>
          </DialogHeader>
          <RecordTagBadges tags={recordTags(meeting)} />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[var(--archive-panel)] p-4"><CalendarDays className="size-5 text-primary" /><span className="mt-3 block text-[13px] text-muted-foreground">회의일</span><strong className="mt-1 block text-sm">{formatPeriod(meeting.meetingDate, null)}</strong></div>
            <div className="rounded-2xl bg-[var(--archive-panel)] p-4"><Users className="size-5 text-primary" /><span className="mt-3 block text-[13px] text-muted-foreground">참석자</span><strong className="mt-1 block text-sm">{meeting.attendeeCount ? meeting.attendeeCount + "명" : "미입력"}</strong></div>
            <div className="rounded-2xl bg-[var(--archive-panel)] p-4"><MapPin className="size-5 text-primary" /><span className="mt-3 block text-[13px] text-muted-foreground">장소</span><strong className="mt-1 block text-sm">{meeting.location || "미입력"}</strong></div>
          </div>
          {meeting.purpose && <DetailSection title="회의 목적"><p className="whitespace-pre-wrap">{meeting.purpose}</p></DetailSection>}
          <DetailSection title="핵심 요약"><p className="whitespace-pre-wrap">{meeting.summary || "입력된 요약이 없습니다."}</p></DetailSection>
          {meeting.participants && <DetailSection title="참석자"><p className="whitespace-pre-wrap">{meeting.participants}</p></DetailSection>}
          {meeting.discussion && <DetailSection title="논의 내용"><p className="whitespace-pre-wrap">{meeting.discussion}</p></DetailSection>}
          {meeting.decisions && <DetailSection title="결정 사항"><MeetingLines value={meeting.decisions} /></DetailSection>}
          {meeting.actionItems && <DetailSection title="후속 업무"><MeetingLines value={meeting.actionItems} /></DetailSection>}
          {meeting.source && <DetailSection title="원본 정보"><p className="whitespace-pre-wrap">{meeting.source}</p></DetailSection>}
        </>}
      </DialogContent>
    </Dialog>
  );
}

function MeetingLines({ value }: { value: string }) {
  const lines = splitLines(value);
  if (lines.length <= 1) return <p className="whitespace-pre-wrap">{value}</p>;
  return <ul className="space-y-2">{lines.map((line, index) => <li key={line + "-" + index} className="flex gap-2"><ListChecks className="mt-1 size-4 shrink-0 text-primary" /><span>{line}</span></li>)}</ul>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-7 border-t pt-6"><h3 className="text-lg font-semibold">{title}</h3><div className="mt-3 text-base leading-7 text-muted-foreground">{children}</div></section>;
}

function RecordTagBadges({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return <div className="mt-4 flex flex-wrap justify-center gap-2">{tags.map((tag) => <Badge key={tag} variant="outline" className="rounded-full px-3 py-1 text-sm">#{tag}</Badge>)}</div>;
}

function DetailStat({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="rounded-2xl bg-[var(--archive-panel)] p-4"><Icon className="size-5 text-primary" /><span className="mt-3 block text-[13px] text-muted-foreground">{label}</span><strong className="mt-1 block text-sm font-semibold">{value}</strong></div>;
}

function EventForm({ saving, setSaving, onSaved }: { saving: boolean; setSaving: (value: boolean) => void; onSaved: () => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const status = form.get("status") === "published" ? "published" : "draft";
    try {
      const photoFiles = form.getAll("cover").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      if (photoFiles.length > 20) throw new Error("행사 사진은 최대 20장까지 등록할 수 있습니다.");
      const uploadedPhotos: Array<{ key: string; name: string }> = [];
      for (const photo of photoFiles) uploadedPhotos.push(await uploadFile(photo, "preview"));
      const programs = String(form.get("programs") ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
        const [name, audience = "", schedule = "", instructors = "", description = ""] = line.split("|").map((part) => part.trim());
        return { name, audience, schedule, instructors, description };
      });
      const response = await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        title: form.get("title"), branch: form.get("branch"), startDate: form.get("startDate"), endDate: form.get("endDate") || null, venue: form.get("venue"), audiences: String(form.get("audiences") ?? "").split(",").map((value) => value.trim()).filter(Boolean), eventType: form.get("eventType"), participantCount: Number(form.get("participantCount") || 0), externalCount: Number(form.get("externalCount") || 0), budget: form.get("budget") ? Number(form.get("budget")) : null, summary: form.get("summary"), review: form.get("review"), sourceUrl: form.get("sourceUrl"), sourceDate: form.get("sourceDate"), sourceAuthor: form.get("sourceAuthor"), status, coverKey: uploadedPhotos[0]?.key ?? null, coverName: uploadedPhotos[0]?.name ?? null, images: uploadedPhotos, programs, tags: parseTagValue(String(form.get("tags") ?? "")),
      }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
      toast.success(status === "published" ? "이벤트를 직원에게 공개했습니다." : "이벤트 초안을 저장했습니다.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally { setSaving(false); }
  }
  return <form className="space-y-5" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><Field label="이벤트명" name="title" required /><Field label="지점" name="branch" placeholder="예: 사우캠퍼스" required /><Field label="시작일" name="startDate" type="date" required /><Field label="종료일" name="endDate" type="date" /><Field label="대상" name="audiences" placeholder="신입생, 학부모" required /><Field label="이벤트 유형" name="eventType" placeholder="예: 체험 행사" required /><Field label="참여 인원" name="participantCount" type="number" min="0" /><Field label="외부 인원" name="externalCount" type="number" min="0" /><Field label="총예산(원)" name="budget" type="number" min="0" /><Field label="장소" name="venue" /></div><TagEditor name="tags" suggestions={["학부모간담회", "입시설명회", "진로멘토링", "장학시상", "학교연계", "공개수업", "체험행사", "디자인", "애니", "초중등"]} /><TextField label="행사 개요" name="summary" placeholder="밴드 게시물의 핵심 내용을 정리해 주세요." /><TextField label="후기와 개선점" name="review" /><TextField label="세부 프로그램" name="programs" placeholder={'한 줄에 하나씩 입력\n프로그램명 | 대상 | 시간 | 강사 | 내용'} rows={4} /><div className="grid gap-4 sm:grid-cols-2"><Field label="원문 작성자" name="sourceAuthor" /><Field label="원문 게시일" name="sourceDate" type="date" /><Field label="밴드 원문 URL" name="sourceUrl" type="url" /><FileField label="행사 사진 (최대 20장)" name="cover" accept="image/png,image/jpeg,image/webp,image/gif" multiple /></div><DialogFooter className="gap-2"><Button type="submit" name="status" value="draft" variant="outline" disabled={saving}>초안 저장</Button><Button type="submit" name="status" value="published" disabled={saving}>{saving && <LoaderCircle className="size-4 animate-spin" />}저장 후 직원 공개</Button></DialogFooter></form>;
}

function MarketingForm({ events, saving, setSaving, demoMode, onSaved }: { events: EventRecord[]; saving: boolean; setSaving: (value: boolean) => void; demoMode: boolean; onSaved: (asset?: MarketingAsset) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const status = form.get("status") === "published" ? "published" : "draft";
    try {
      const preview = form.get("preview") as File;
      const source = form.get("source") as File;
      const createdDate = String(form.get("createdDate"));
      const selectedEvent = form.get("relatedEventId");
      const common = { title: String(form.get("title")), branch: String(form.get("branch")), createdDate, assetType: String(form.get("assetType")), target: String(form.get("target")), channel: String(form.get("channel")), campaignYear: Number(createdDate.slice(0, 4)), fileFormat: String(form.get("fileFormat")), specifications: String(form.get("specifications")), quantity: Number(form.get("quantity") || 0), driveUrl: String(form.get("driveUrl")), notes: String(form.get("notes")), relatedEventId: selectedEvent && selectedEvent !== "none" ? String(selectedEvent) : null };
      if (demoMode) {
        const previewUrl = preview?.size ? URL.createObjectURL(preview) : null;
        const sourceUrl = source?.size ? URL.createObjectURL(source) : null;
        onSaved({ id: crypto.randomUUID(), ...common, previewUrl, sourceUrl, galleryImages: previewUrl ? [{ src: previewUrl, alt: common.title }] : [], status: "published", demo: true });
        toast.success("체험판 제작물 기록에 추가했습니다. 새로고침하면 초기화됩니다.");
        return;
      }
      const previewUpload = preview?.size ? await uploadFile(preview, "preview") : null;
      const sourceUpload = source?.size ? await uploadFile(source, "source") : null;
      const response = await fetch("/api/marketing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...common, previewKey: previewUpload?.key ?? null, previewName: previewUpload?.name ?? null, sourceKey: sourceUpload?.key ?? null, sourceName: sourceUpload?.name ?? null, status }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
      toast.success(status === "published" ? "제작물을 직원에게 공개했습니다." : "제작물 초안을 저장했습니다.");
      onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  return <form className="space-y-5" onSubmit={submit}><div className="rounded-xl bg-muted/55 p-4 text-sm leading-6 text-muted-foreground">노트·배너·SNS 등 제작물 종류와 관계없이 같은 항목으로 기록합니다. 규격과 Drive 링크를 입력하면 다음 제작 때 바로 찾아 재사용할 수 있습니다.</div><div className="grid gap-4 sm:grid-cols-2"><Field label="제작물명" name="title" required /><Field label="지점" name="branch" placeholder="예: 본사 공통" required /><Field label="제작일" name="createdDate" type="date" required /><div className="space-y-2"><Label htmlFor="assetType">종류</Label><Select name="assetType" defaultValue="SNS"><SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["노트", "배너", "SNS", "포스터", "카드뉴스", "현수막", "리플렛", "안내책자", "기타"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><Field label="대상" name="target" placeholder="학부모, 신입생" required /><Field label="채널" name="channel" placeholder="인스타그램, 원내 게시" /><Field label="규격" name="specifications" placeholder="A2 세로형, 1080×1350px" /><Field label="수량" name="quantity" type="number" min="0" /><Field label="파일 형식" name="fileFormat" placeholder="PSD · JPG · PDF" /><Field label="Google Drive 링크" name="driveUrl" type="url" placeholder="완성본 폴더 또는 파일 링크" /><div className="space-y-2"><Label htmlFor="relatedEventId">관련 이벤트</Label><Select name="relatedEventId"><SelectTrigger className="w-full rounded-xl"><SelectValue placeholder="연결 안 함" /></SelectTrigger><SelectContent><SelectItem value="none">연결 안 함</SelectItem>{events.map((event) => <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>)}</SelectContent></Select></div></div><TextField label="메모" name="notes" placeholder="사용 목적, 재활용 시 주의사항, 캠페인 핵심 문구 등을 적어 주세요." /><div className="grid gap-4 sm:grid-cols-2"><FileField label="미리보기 이미지" name="preview" accept="image/png,image/jpeg,image/webp,image/gif" /><FileField label="원본 파일" name="source" accept="image/*,.pdf,.zip,.ai,.psd" /></div><DialogFooter className="gap-2"><Button type="submit" name="status" value="draft" variant="outline" disabled={saving}>초안 저장</Button><Button type="submit" name="status" value="published" disabled={saving}>{saving && <LoaderCircle className="size-4 animate-spin" />}저장 후 직원 공개</Button></DialogFooter></form>;
}

function MeetingForm({ saving, setSaving, onSaved }: { saving: boolean; setSaving: (value: boolean) => void; onSaved: () => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const status = form.get("status") === "published" ? "published" : "draft";
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          meetingDate: form.get("meetingDate"),
          organization: form.get("organization"),
          location: form.get("location"),
          participants: form.get("participants"),
          attendeeCount: Number(form.get("attendeeCount") || 0),
          purpose: form.get("purpose"),
          summary: form.get("summary"),
          discussion: form.get("discussion"),
          decisions: form.get("decisions"),
          actionItems: form.get("actionItems"),
          source: form.get("source"),
          tags: parseTagValue(String(form.get("tags") ?? "")),
          status,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
      toast.success(status === "published" ? "회의록을 직원에게 공개했습니다." : "회의록 초안을 저장했습니다.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="회의 제목" name="title" required />
        <Field label="회의일" name="meetingDate" type="date" required />
        <Field label="지점 또는 부서" name="organization" placeholder="예: 본사 · 지점 공동" />
        <Field label="장소" name="location" />
        <Field label="참석 인원" name="attendeeCount" type="number" min="0" />
        <Field label="원본 출처" name="source" placeholder="파일명 또는 작성자" />
      </div>
      <TextField label="참석자" name="participants" placeholder="이름이나 직책을 쉼표로 구분해 입력해 주세요." />
      <TagEditor name="tags" suggestions={["운영회의", "커리큘럼", "공모전", "실기연구", "공동품평", "재등록관리", "시스템개발", "공동제작실", "디자인실기", "애니", "초중등"]} />
      <TextField label="회의 목적" name="purpose" />
      <TextField label="핵심 요약" name="summary" placeholder="회의 결과를 짧게 정리해 주세요." />
      <TextField label="논의 내용" name="discussion" rows={6} />
      <TextField label="결정 사항" name="decisions" placeholder="한 줄에 하나씩 입력해 주세요." rows={5} />
      <TextField label="후속 업무" name="actionItems" placeholder="업무 | 담당자 | 기한 순서로 한 줄에 하나씩 입력해 주세요." rows={5} />
      <DialogFooter className="gap-2">
        <Button type="submit" name="status" value="draft" variant="outline" disabled={saving}>초안 저장</Button>
        <Button type="submit" name="status" value="published" disabled={saving}>{saving && <LoaderCircle className="size-4 animate-spin" />}저장 후 직원 공개</Button>
      </DialogFooter>
    </form>
  );
}

function TagEditor({ name, suggestions }: { name: string; suggestions: string[] }) {
  const [tags, setTags] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const addTag = (raw: string) => {
    const tag = raw.replace(/^#+/, "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (!tag || tags.length >= 8 || tags.some((item) => item.toLocaleLowerCase("ko-KR") === tag.toLocaleLowerCase("ko-KR"))) return;
    setTags((items) => [...items, tag]);
    setInput("");
  };
  const hiddenValue = [...tags, ...(input.trim() && tags.length < 8 ? [input.trim()] : [])].join(",");
  return (
    <div className="space-y-2">
      <Label htmlFor={`${name}-input`}>태그 <span className="font-normal text-muted-foreground">(최대 8개)</span></Label>
      <input type="hidden" name={name} value={hiddenValue} />
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
        {tags.map((tag) => <button key={tag} type="button" className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary" onClick={() => setTags((items) => items.filter((item) => item !== tag))}>#{tag}<span aria-hidden="true">×</span></button>)}
        <input id={`${name}-input`} value={input} onChange={(event) => setInput(event.target.value.replace(",", ""))} onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent.isComposing) {
            event.preventDefault();
            addTag(input);
          }
          if (event.key === "Backspace" && !input && tags.length) setTags((items) => items.slice(0, -1));
        }} placeholder={tags.length ? "태그 추가" : "태그를 입력하고 Enter"} className="min-w-36 flex-1 bg-transparent py-1 text-sm outline-none" disabled={tags.length >= 8} />
      </div>
      <div className="flex flex-wrap gap-1.5">{suggestions.filter((tag) => !tags.includes(tag)).slice(0, 10).map((tag) => <Button key={tag} type="button" size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs text-muted-foreground" onClick={() => addTag(tag)}>+ #{tag}</Button>)}</div>
    </div>
  );
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} className="rounded-xl" {...props} /></div>; }
function TextField({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Textarea>) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} className="min-h-24 rounded-xl" {...props} /></div>; }
function FileField({ label, name, accept, multiple = false }: { label: string; name: string; accept: string; multiple?: boolean }) {
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 text-sm text-muted-foreground hover:bg-muted"><Upload className="size-4 shrink-0" /><span className="truncate">{selectedNames.length ? multiple ? `${selectedNames.length}개 파일 선택됨` : selectedNames[0] : multiple ? "여러 사진 선택" : "파일 선택"}</span><Input id={name} name={name} type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(event) => setSelectedNames(Array.from(event.target.files ?? []).map((file) => file.name))} /></label>{multiple && selectedNames.length > 0 && <p className="line-clamp-2 text-xs text-muted-foreground">{selectedNames.join(" · ")}</p>}</div>;
}

async function uploadFile(file: File, purpose: "preview" | "source") {
  const body = new FormData();
  body.set("file", file);
  body.set("purpose", purpose);
  const response = await fetch("/api/uploads", { method: "POST", body });
  const data = await response.json() as { key?: string; name?: string; error?: string };
  if (!response.ok || !data.key || !data.name) throw new Error(data.error ?? "파일 업로드에 실패했습니다.");
  return { key: data.key, name: data.name };
}

function EmptyState({ onReset }: { onReset: () => void }) { return <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"><div><Search className="mx-auto size-8 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">조건에 맞는 자료가 없습니다.</h3><p className="mt-2 text-sm text-muted-foreground">필터를 초기화한 뒤 다시 검색해 보세요.</p><Button variant="outline" className="mt-5 rounded-xl" onClick={onReset}>필터 초기화</Button></div></div>; }
function MeetingEmptyState({ demoMode, role, onCreate }: { demoMode: boolean; role: Role; onCreate: () => void }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <div className="max-w-lg">
        <NotebookTabs className="mx-auto size-9 text-primary" />
        <h3 className="mt-4 text-lg font-semibold">등록된 회의록이 없습니다.</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {demoMode
            ? "회의 자료를 정리해 등록하면 제목과 참석자, 결정사항으로 찾아볼 수 있습니다."
            : "기존 회의록을 먼저 등록하면 실제 내용에 맞춰 검색 기준과 분류 체계를 정리할 수 있습니다."}
        </p>
        {role === "admin" && !demoMode && <Button className="mt-5 rounded-xl" onClick={onCreate}><Plus className="size-4" />첫 회의록 등록</Button>}
      </div>
    </div>
  );
}
function FullScreenLoading() { return <div className="grid min-h-screen place-items-center bg-[var(--archive-canvas)] text-primary"><LoaderCircle className="size-8 animate-spin" aria-label="불러오는 중" /></div>; }
function formatPeriod(start: string, end: string | null) { return end && end !== start ? `${start.replaceAll("-", ".")}–${end.replaceAll("-", ".")}` : start.replaceAll("-", "."); }
function splitLines(value: string) { return value.split(/\r?\n/).map((line) => line.trim().replace(/^[-*•]\s*/, "")).filter(Boolean); }
function countLines(value: string) { return splitLines(value).length; }
function parseTagValue(value: string) { return [...new Map(value.split(",").map((tag) => tag.replace(/^#+/, "").trim().replace(/\s+/g, " ")).filter(Boolean).slice(0, 8).map((tag) => [tag.toLocaleLowerCase("ko-KR"), tag])).values()]; }

function filterDemoEvents(query: string, branch: string, target: string, budget: string, tags: string[] = []) {
  const normalized = query.trim().toLowerCase();
  return demoEvents.filter((event) => (!normalized || [event.title, event.summary, event.eventType, event.branch].join(" ").toLowerCase().includes(normalized)) && (branch === "all" || event.branch === branch) && (target === "all" || event.audiences.includes(target)) && (budget === "all" || (budget === "under50" && event.budget !== null && event.budget <= 500000) || (budget === "over50" && event.budget !== null && event.budget > 500000)) && tags.every((tag) => recordTags(event).includes(tag)));
}
function filterDemoAssets(query: string, branch: string, target: string) {
  const normalized = query.trim().toLowerCase();
  return demoAssets.filter((asset) => (!normalized || [asset.title, asset.assetType, asset.channel, asset.branch, asset.target, asset.notes].join(" ").toLowerCase().includes(normalized)) && (branch === "all" || asset.branch === branch) && (target === "all" || asset.target === target || asset.target.split(/[·,]/).map((value) => value.trim()).includes(target)));
}
function filterDemoMeetings(query: string, tags: string[] = []) {
  const normalized = query.trim().toLowerCase();
  return demoMeetings.filter((meeting) => (!normalized || [meeting.title, meeting.organization, meeting.location, meeting.participants, meeting.purpose, meeting.summary, meeting.discussion, meeting.decisions, meeting.actionItems].join(" ").toLowerCase().includes(normalized)) && tags.every((tag) => recordTags(meeting).includes(tag)));
}
