import { Router, type IRouter } from "express";
import {
  AnalyzeMaterialBody,
  AnalyzeMaterialResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const CATEGORY_REFERENCE = `
一级领域（dimension）只能使用：
economy/经济、politics/政治、culture/文化、society/社会、ecology/生态。

二级主题、三级方向与关键词只能从下面选择：
乡村振兴 rural_revitalization：
产业兴旺 industrial_prosperity（特色农业、农村电商、乡村旅游、产业链延伸、集体经济）；
人才支撑 talent_support（新农人、科技特派员、返乡创业、职业农民、人才下沉）；
文化振兴 cultural_revitalization（乡风文明、移风易俗、传统村落保护、村规民约、文化礼堂）；
生态宜居 ecological_livability（人居环境整治、厕所革命、污水垃圾处理、生态补偿、绿色农业）；
组织振兴 organizational_revitalization（基层党组织、村民自治、村务公开、法治乡村、平安建设）。

党的建设 party_building：
党建引领 party_leadership（组织建设、先锋模范、思想武装、党史学习教育）；
实干担当 practical_responsibility（调查研究、基层减负、担当作为、斗争精神）；
清正廉洁 integrity（八项规定、作风建设、反腐倡廉、纪律规矩）；
服务为民 people_oriented_service（群众路线、便民服务、接诉即办、人民立场）；
干部建设 cadre_building（能力提升、激励容错、能上能下、干部交流）。

科技创新 technological_innovation：
自主自强 independent_innovation（核心技术、基础研究、战略力量、揭榜挂帅）；
数字赋能 digital_empowerment（人工智能、产业数字化、智慧场景、数据要素）；
人才驱动 talent_driven_innovation（人才评价、青年科学家、科学家精神、工匠精神）；
成果转化 achievement_transformation（产学研用、科创平台、首台套、技术经理人）；
创新生态 innovation_ecosystem（创新文化、科技金融、容错机制、科学普及）。

文化建设 cultural_development：
文化自信 cultural_confidence（核心价值观、优秀传统、革命文化、文明互鉴）；
传承创新 inheritance_innovation（非遗保护、文物活化、老字号、文化基因）；
公共文化 public_culture（文化惠民、服务均等、数字资源、设施建设）；
文化产业 cultural_industry（文旅融合、创意设计、国潮出海、知识产权）；
精神文明 spiritual_civilization（移风易俗、志愿服务、诚信建设、家风家教）。

经济发展 economic_development：
高质量发展 high_quality_development（质效提升、现代化经济体系、新发展格局）；
创新驱动 innovation_driven_growth（核心技术、数字中国、专精特新、新质生产力）；
产业升级 industrial_upgrading（三产融合、高端制造、数字经济、营商环境）；
新型消费 new_consumption（消费升级、数字经济、直播电商、县域商业）；
区域协调 regional_coordination（城乡融合、新型城镇化、共同富裕、飞地经济）。

社会治理 social_governance：
基层治理 grassroots_governance（三治融合、减负赋能、吹哨报到、枫桥经验）；
数字治理 digital_governance（一网通办、数据共享、智慧城市、数字鸿沟）；
风险防控 risk_prevention（源头化解、信用体系、市场监督、金融风险）；
多元共治 multi_party_governance（社会组织、志愿服务、公益慈善、政企合作）；
公共安全 public_safety（应急体系、安全生产、防灾减灾、公共卫生）。

民生保障 livelihood_security：
教育均衡 education_equity（普惠发展、双减政策、城乡资源、职业教育）；
健康中国 healthy_china（分级诊疗、医保改革、中医药、公共卫生）；
一老一小 elderly_children（普惠养老、婴幼儿照护、适老化改造、老龄产业）；
社会保障 social_security（养老保险、救助体系、长护险、保障住房）；
就业优先 employment_priority（稳岗扩岗、技能提升、重点帮扶、灵活就业）；
共同富裕 common_prosperity（收入分配、三次分配、基本公共服务均等化、兜底保障）。

生态环保 ecological_environment：
绿色发展 green_development（循环经济、能源结构、绿色金融、双碳目标）；
生态修复 ecological_restoration（山水林田湖草沙、生物多样、国土绿化、流域治理）；
制度保障 institutional_guarantee（生态红线、生态补偿、环保督察、河湖长制）；
价值转化 value_transformation（生态产品、碳汇交易、生态旅游、两山理论）；
污染防治 pollution_prevention（蓝天碧水净土、面源污染、排污许可、环境执法）。
`;

const ARGUMENT_TYPES = [
  "政策背景",
  "问题表现",
  "原因分析",
  "实践路径",
  "成效案例",
  "经验启示",
  "对策建议",
  "价值意义",
];

const SYSTEM_PROMPT = `你是一名专业的申论素材整理与分类助手。
你只负责从用户输入中提取和结构化信息，不评价素材优劣，不自由创建分类。
${CATEGORY_REFERENCE}

分类规则：
1. primary 必须只有一个，优先按核心议题、主要解决的问题、实践对象、政策目标和实践路径判断。
2. secondary 最多 3 个，仅保留有明显解释力的跨领域分类，不能重复 primary。
3. keywords 只能来自对应三级方向的关键词，最多 5 个；不要为了凑数添加。
4. argument_types 只能从以下固定选项中选择 1～3 个：${ARGUMENT_TYPES.join("、")}。
5. core_value 用 1～2 句话提炼申论写作价值，不超过 80 个汉字，不复述原文。
6. 信息不足时宁可少分类；所有 id 和 name 必须对应并且准确。

严格只输出合法 JSON，不要 Markdown、代码围栏、解释或额外文字。JSON 结构必须是：
{
  "title": "标题",
  "summary": "摘要",
  "primary": {"dimension": {"id": "...", "name": "..."}, "theme": {"id": "...", "name": "..."}, "direction": {"id": "...", "name": "..."}},
  "secondary": [],
  "keywords": [],
  "argument_types": [],
  "core_value": "..."
}`;

function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] ?? content).trim();
}

router.post("/materials/analyze", async (req, res) => {
  const parsed = AnalyzeMaterialBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "请输入至少 20 个字的素材内容。" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "AI 服务尚未配置，请稍后再试。" });
    return;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `请整理下面这条申论素材：\n\n${parsed.data.content.slice(0, 20000)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      req.log.error(
        { status: response.status, errorBody: errorBody.slice(0, 500) },
        "OpenAI analysis request failed",
      );
      res.status(502).json({ error: "AI 分析暂时失败，请稍后重试。" });
      return;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: "AI 没有返回可用的分析结果。" });
      return;
    }

    const result = AnalyzeMaterialResponse.safeParse(
      JSON.parse(extractJson(content)),
    );
    if (!result.success) {
      req.log.error({ issues: result.error.issues }, "Invalid AI analysis shape");
      res.status(502).json({ error: "AI 返回的数据格式不完整，请重新分析。" });
      return;
    }

    res.json(result.data);
  } catch (error) {
    req.log.error({ err: error }, "Unexpected material analysis failure");
    res.status(502).json({ error: "AI 分析暂时失败，请稍后重试。" });
  }
});

export default router;