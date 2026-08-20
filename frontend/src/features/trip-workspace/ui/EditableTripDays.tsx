import { useEffect, useState } from 'react'
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  RedoOutlined,
  RobotOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, List, message, Modal, Popconfirm, Row, Select, Space, Tooltip, Typography } from 'antd'
import VerificationBadge from '@/components/VerificationBadge'
import type { Attraction, TripPlan } from '@/types/api'
import { proposePartialReplan } from '@/services/tripApi'
import { useTripWorkspace } from '../model/useTripWorkspace'
import './editableTripDays.css'

interface Props {
  initialPlan: TripPlan
  planId?: string
  onPlanChange: (plan: TripPlan) => void
}

interface EditTarget {
  dayIndex: number
  attractionIndex: number
}

type AttractionFields = Pick<Attraction, 'name' | 'address' | 'start_time' | 'end_time' | 'visit_duration' | 'description'>

const emptyAttraction = (): Attraction => ({
  name: '新景点',
  address: '',
  location: { longitude: 0, latitude: 0 },
  visit_duration: 90,
  description: '',
  verification_status: 'needs_verification',
  source: 'user',
})

export default function EditableTripDays({ initialPlan, planId, onPlanChange }: Props) {
  const { state, dispatch, canUndo, canRedo } = useTripWorkspace(initialPlan, planId)
  const [editTarget, setEditTarget] = useState<EditTarget>()
  const [replanOpen, setReplanOpen] = useState(false)
  const [replanSubmitting, setReplanSubmitting] = useState(false)
  const [replanInstruction, setReplanInstruction] = useState('')
  const [replanScope, setReplanScope] = useState<'day' | 'all'>('day')
  const [replanDayIndex, setReplanDayIndex] = useState(0)
  const [form] = Form.useForm<AttractionFields>()

  useEffect(() => onPlanChange(state.present), [onPlanChange, state.present])

  const openEditor = (dayIndex: number, attractionIndex: number) => {
    const item = state.present.days[dayIndex].attractions[attractionIndex]
    form.setFieldsValue(item)
    setEditTarget({ dayIndex, attractionIndex })
  }

  const saveEditor = async () => {
    if (!editTarget) return
    const values = await form.validateFields()
    dispatch({ type: 'attraction.update', ...editTarget, patch: values })
    setEditTarget(undefined)
  }

  const requestReplan = async () => {
    if (!replanInstruction.trim()) {
      message.warning('请先描述你希望如何调整')
      return
    }
    if (!planId) {
      message.error('当前行程缺少 Plan ID，无法请求 AI 调整')
      return
    }
    setReplanSubmitting(true)
    try {
      const changeSet = await proposePartialReplan(planId, {
        instruction: replanInstruction.trim(),
        scope: replanScope,
        day_index: replanScope === 'day' ? replanDayIndex : undefined,
        current_plan: state.present,
      })
      dispatch({ type: 'changeset.preview', changeSet })
      setReplanOpen(false)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'AI 调整暂时不可用')
    } finally {
      setReplanSubmitting(false)
    }
  }

  const operationText = (operation: NonNullable<typeof state.pendingChangeSet>['operations'][number]) => {
    const labels: Record<string, string> = {
      'attraction.add': '新增景点', 'attraction.remove': '删除景点', 'attraction.update': '更新景点',
      'attraction.move': '移动景点', 'hotel.update': '更新酒店', 'day.update': '更新当天安排',
    }
    const day = 'dayIndex' in operation ? operation.dayIndex : 'fromDayIndex' in operation ? operation.fromDayIndex : undefined
    return `${labels[operation.type] ?? operation.type}${typeof day === 'number' ? ` · 第 ${day + 1} 天` : ''}`
  }

  return (
    <section className="trip-workspace" aria-label="可编辑每日行程">
      <div className="workspace-toolbar">
        <div>
          <Typography.Title level={3}>每日行程工作区</Typography.Title>
          <Typography.Text type="secondary">
            修改会自动保存在当前浏览器。AI 建议与真实数据使用不同标签标识。
          </Typography.Text>
        </div>
        <Space wrap>
          <Tooltip title="撤销上一步修改">
            <Button aria-label="撤销" icon={<UndoOutlined />} disabled={!canUndo} onClick={() => dispatch({ type: 'undo' })} />
          </Tooltip>
          <Tooltip title="重做已撤销的修改">
            <Button aria-label="重做" icon={<RedoOutlined />} disabled={!canRedo} onClick={() => dispatch({ type: 'redo' })} />
          </Tooltip>
          <Button type="primary" icon={<RobotOutlined />} onClick={() => setReplanOpen(true)}>AI 局部调整</Button>
          <span className="draft-status" aria-live="polite">
            {state.lastSavedAt ? `草稿已保存 ${new Date(state.lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '正在保存草稿'}
          </span>
        </Space>
      </div>

      <div className="workspace-days">
        {state.present.days.map((day, dayIndex) => (
          <Card
            key={`${day.date}-${day.day_index}`}
            className="workspace-day"
            title={
              <div className="workspace-day-title">
                <span className="day-index">D{dayIndex + 1}</span>
                <span>{day.date}</span>
                {day.city && <span className="day-city"><EnvironmentOutlined /> {day.city}</span>}
              </div>
            }
            extra={<Button aria-label="添加景点" icon={<PlusOutlined />} onClick={() => dispatch({ type: 'attraction.add', dayIndex, attraction: emptyAttraction() })}>添加景点</Button>}
          >
            {day.is_transfer_day && <div className="transfer-note">城际转移 · {day.transfer_info || day.transportation}</div>}
            {day.hotel && (
              <div className="workspace-hotel">
                <div><strong>住宿：</strong>{day.hotel.name} · {day.hotel.address}</div>
                <VerificationBadge metadata={day.hotel} />
              </div>
            )}

            {day.attractions.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当天还没有景点" />
            ) : (
              <ol className="attraction-list">
                {day.attractions.map((item, attractionIndex) => (
                  <li key={`${item.poi_id ?? item.name}-${attractionIndex}`} className="attraction-row">
                    <div className="attraction-time">
                      <span>{item.start_time || '--:--'}</span>
                      <small>{item.visit_duration} 分钟</small>
                    </div>
                    <div className="attraction-content">
                      <div className="attraction-heading">
                        <strong>{item.name}</strong>
                        <VerificationBadge metadata={item} />
                      </div>
                      <span>{item.address || '地址待补充'}</span>
                      {item.description && <p>{item.description}</p>}
                    </div>
                    <Space className="attraction-actions" size={4} wrap>
                      <Tooltip title="上移"><Button aria-label={`上移${item.name}`} size="small" icon={<ArrowUpOutlined />} disabled={attractionIndex === 0} onClick={() => dispatch({ type: 'attraction.move', fromDayIndex: dayIndex, attractionIndex, toDayIndex: dayIndex, at: attractionIndex - 1 })} /></Tooltip>
                      <Tooltip title="下移"><Button aria-label={`下移${item.name}`} size="small" icon={<ArrowDownOutlined />} disabled={attractionIndex === day.attractions.length - 1} onClick={() => dispatch({ type: 'attraction.move', fromDayIndex: dayIndex, attractionIndex, toDayIndex: dayIndex, at: attractionIndex + 1 })} /></Tooltip>
                      <Tooltip title="移到前一天"><Button aria-label={`前移一天${item.name}`} size="small" icon={<ArrowLeftOutlined />} disabled={dayIndex === 0} onClick={() => dispatch({ type: 'attraction.move', fromDayIndex: dayIndex, attractionIndex, toDayIndex: dayIndex - 1 })} /></Tooltip>
                      <Tooltip title="移到后一天"><Button aria-label={`后移一天${item.name}`} size="small" icon={<ArrowRightOutlined />} disabled={dayIndex === state.present.days.length - 1} onClick={() => dispatch({ type: 'attraction.move', fromDayIndex: dayIndex, attractionIndex, toDayIndex: dayIndex + 1 })} /></Tooltip>
                      <Tooltip title="编辑"><Button aria-label={`编辑${item.name}`} size="small" icon={<EditOutlined />} onClick={() => openEditor(dayIndex, attractionIndex)} /></Tooltip>
                      <Popconfirm title="删除这个景点？" description="可通过撤销恢复。" onConfirm={() => dispatch({ type: 'attraction.remove', dayIndex, attractionIndex })}>
                        <Button aria-label={`删除${item.name}`} danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        ))}
      </div>

      <Modal title="编辑景点" open={Boolean(editTarget)} onCancel={() => setEditTarget(undefined)} onOk={() => void saveEditor()} okText="保存" cancelText="取消" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={14}><Form.Item name="name" label="景点名称" rules={[{ required: true, message: '请输入景点名称' }]}><Input /></Form.Item></Col>
            <Col span={10}><Form.Item name="visit_duration" label="游览分钟" rules={[{ required: true }]}><InputNumber min={15} max={720} step={15} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="start_time" label="开始时间"><Input placeholder="09:30" pattern="([01]\\d|2[0-3]):[0-5]\\d" /></Form.Item></Col>
            <Col span={12}><Form.Item name="end_time" label="结束时间"><Input placeholder="11:00" pattern="([01]\\d|2[0-3]):[0-5]\\d" /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="备注"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="让 AI 提出调整方案" open={replanOpen} confirmLoading={replanSubmitting} onCancel={() => setReplanOpen(false)} onOk={() => void requestReplan()} okText="生成变更预览" cancelText="取消">
        <Alert type="info" showIcon title="AI 不会直接改写你的行程" description="系统会先返回一组通过白名单校验的变更，你可以逐项预览后接受或拒绝。" />
        <Form layout="vertical" style={{ marginTop: 18 }}>
          <Form.Item label="调整范围">
            <Select value={replanScope} onChange={setReplanScope} options={[{ value: 'day', label: '指定某一天' }, { value: 'all', label: '整个行程' }]} />
          </Form.Item>
          {replanScope === 'day' && (
            <Form.Item label="选择日期">
              <Select value={replanDayIndex} onChange={setReplanDayIndex} options={state.present.days.map((day, index) => ({ value: index, label: `第 ${index + 1} 天 · ${day.date}${day.city ? ` · ${day.city}` : ''}` }))} />
            </Form.Item>
          )}
          <Form.Item label="希望怎样调整">
            <Input.TextArea value={replanInstruction} maxLength={1000} showCount rows={4} onChange={(event) => setReplanInstruction(event.target.value)} placeholder="例如：第二天下午减少步行，保留博物馆，并安排一间适合亲子的餐厅。" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={state.pendingChangeSet?.title ?? 'AI 变更预览'}
        open={Boolean(state.pendingChangeSet)}
        onCancel={() => dispatch({ type: 'changeset.reject' })}
        footer={[
          <Button key="reject" onClick={() => dispatch({ type: 'changeset.reject' })}>拒绝变更</Button>,
          <Button key="apply" type="primary" onClick={() => { dispatch({ type: 'changeset.apply' }); message.success('变更已应用，可随时撤销') }}>接受并应用</Button>,
        ]}
      >
        <Alert type="warning" showIcon title="请确认后再应用" description={state.pendingChangeSet?.summary} />
        <List style={{ marginTop: 12 }} bordered dataSource={state.pendingChangeSet?.operations ?? []} renderItem={(operation, index) => <List.Item><Typography.Text strong>{index + 1}. {operationText(operation)}</Typography.Text></List.Item>} />
      </Modal>
    </section>
  )
}
