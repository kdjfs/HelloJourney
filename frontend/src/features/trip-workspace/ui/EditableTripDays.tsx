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
  UndoOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Space, Tooltip, Typography } from 'antd'
import VerificationBadge from '@/components/VerificationBadge'
import type { Attraction, TripPlan } from '@/types/api'
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
    </section>
  )
}
