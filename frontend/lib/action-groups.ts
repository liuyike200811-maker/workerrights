import type { ActionStep, ChannelInfo } from "@/types/api";

export type StepGroupId = "self" | "parallel" | "professional";

export interface StepGroup {
  id: StepGroupId;
  title: string;
  description: string;
  steps: ActionStep[];
}

const PROFESSIONAL_CATEGORIES = new Set(["arbitration", "legal_aid", "litigation"]);

// 后端暂无 steps[].priority，分组依据只用它已经返回的渠道类型，不代表法律上必须先做哪一步。
export function groupSteps(steps: ActionStep[], channels: ChannelInfo[]): StepGroup[] {
  const categoryById = new Map(channels.map((channel) => [channel.id, channel.category]));
  const buckets: Record<StepGroupId, ActionStep[]> = { self: [], parallel: [], professional: [] };

  for (const step of steps) {
    const category = step.channel_id ? categoryById.get(step.channel_id) : null;
    if (!category) buckets.self.push(step);
    else if (PROFESSIONAL_CATEGORIES.has(category)) buckets.professional.push(step);
    else buckets.parallel.push(step);
  }

  const titles: Record<StepGroupId, { title: string; description: string }> = {
    self: {
      title: "现在自己就能做",
      description: "不用见面、不用花钱，先把材料和数字整理清楚。",
    },
    parallel: {
      title: "可以并行去反映",
      description: "这几条互不阻塞，同一天分别联系也可以；是否受理以各机构告知为准。",
    },
    professional: {
      title: "先咨询再决定",
      description: "是否需要走仲裁、法律援助或诉讼，取决于你的事实和材料，由机构工作人员判断。",
    },
  };

  return (Object.keys(buckets) as StepGroupId[])
    .filter((id) => buckets[id].length > 0)
    .map((id) => ({ id, ...titles[id], steps: buckets[id] }));
}
