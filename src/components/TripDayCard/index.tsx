import { Card, Tag, Typography, Row, Col, Divider } from 'antd'
import {
  ClockCircleOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  StarOutlined,
} from '@ant-design/icons'
import type { DayPlan, Attraction, Meal, Hotel } from '../../types/api'

const { Text, Paragraph } = Typography

interface TripDayCardProps {
  day: DayPlan
  attractionImages?: Record<string, string>
  onImageError?: () => void
}

const mealTypeMap: Record<string, { label: string; color: string }> = {
  breakfast: { label: '早餐', color: 'orange' },
  lunch: { label: '午餐', color: 'green' },
  dinner: { label: '晚餐', color: 'purple' },
  snack: { label: '小吃', color: 'gold' },
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}分钟`
  if (mins === 0) return `${hours}小时`
  return `${hours}小时${mins}分钟`
}

function AttractionCard({
  item,
  index,
  attractionImages,
  onImageError,
}: {
  item: Attraction
  index: number
  attractionImages?: Record<string, string>
  onImageError?: () => void
}) {
  const imageSrc =
    item.image_url ||
    (attractionImages?.[item.name]) ||
    `https://picsum.photos/seed/${encodeURIComponent(item.name)}/800/600`

  return (
    <Card size="small" className="attraction-card" styles={{ body: { padding: 0 } }}>
      <div className="attraction-image-wrapper">
        <img
          src={imageSrc}
          alt={item.name}
          className="attraction-image"
          onError={onImageError}
        />
        <div className="attraction-badge">
          <span className="badge-number">{index + 1}</span>
        </div>
        {item.ticket_price !== undefined && item.ticket_price > 0 && (
          <div className="price-tag">¥{item.ticket_price}</div>
        )}
      </div>

      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Text strong style={{ fontSize: 15 }}>{item.name}</Text>
          {item.category && <Tag>{item.category}</Tag>}
          {item.rating && (
            <Tag color="gold"><StarOutlined /> {item.rating}</Tag>
          )}
          {item.reservation_required && <Tag color="red">需预约</Tag>}
        </div>

        <Row gutter={[8, 8]}>
          <Col xs={24} sm={8}>
            <Text type="secondary">
              <ClockCircleOutlined /> {formatMinutes(item.visit_duration)}
            </Text>
          </Col>
          <Col xs={24} sm={8}>
            <Text type="secondary">
              <DollarOutlined /> 门票：¥{item.ticket_price ?? 0}
            </Text>
          </Col>
          <Col xs={24} sm={8}>
            <Text type="secondary">
              <EnvironmentOutlined /> {item.address}
            </Text>
          </Col>
        </Row>

        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
          {item.description}
        </Paragraph>

        {item.reservation_required && item.reservation_tips && (
          <Paragraph style={{ marginTop: 4, marginBottom: 0, fontSize: 12, color: '#ff4d4f' }}>
            📋 {item.reservation_tips}
          </Paragraph>
        )}
      </div>
    </Card>
  )
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  return (
    <Card
      size="small"
      title={<span className="hotel-title">{hotel.name}</span>}
      style={{ marginBottom: 16, background: '#fafafa' }}
      type="inner"
    >
      <Row gutter={[8, 8]}>
        <Col xs={12}>
          <Text type="secondary">地址</Text>
          <br />
          <Text>{hotel.address}</Text>
        </Col>
        <Col xs={12}>
          <Text type="secondary">类型</Text>
          <br />
          <Text>{hotel.type}</Text>
        </Col>
        <Col xs={12}>
          <Text type="secondary">价格区间</Text>
          <br />
          <Text>{hotel.price_range}</Text>
        </Col>
        <Col xs={12}>
          <Text type="secondary">评分</Text>
          <br />
          <Text><StarOutlined style={{ color: '#faad14' }} /> {hotel.rating}</Text>
        </Col>
        <Col xs={24}>
          <Text type="secondary">距离</Text>
          <br />
          <Text>{hotel.distance}</Text>
        </Col>
        {hotel.estimated_cost !== undefined && hotel.estimated_cost > 0 && (
          <Col xs={12}>
            <Text type="secondary">预估费用</Text>
            <br />
            <Text><DollarOutlined /> ¥{hotel.estimated_cost}/晚</Text>
          </Col>
        )}
      </Row>
    </Card>
  )
}

function MealCard({ meal }: { meal: Meal }) {
  const mealInfo = mealTypeMap[meal.type] || { label: meal.type, color: 'default' }
  return (
    <Col xs={24} sm={8} key={`${meal.type}-${meal.name}`}>
      <Card size="small" style={{ height: '100%' }}>
        <Tag color={mealInfo.color} style={{ marginBottom: 8 }}>
          {mealInfo.label}
        </Tag>
        <Text strong style={{ display: 'block' }}>{meal.name}</Text>
        {meal.description && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {meal.description}
          </Text>
        )}
        {meal.estimated_cost !== undefined && meal.estimated_cost > 0 && (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <DollarOutlined /> 约¥{meal.estimated_cost}
            </Text>
          </div>
        )}
      </Card>
    </Col>
  )
}

function TripDayCard({ day, attractionImages, onImageError }: TripDayCardProps) {
  return (
    <Card
      title={
        <div className="day-header">
          <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>
            第 {day.day_index + 1} 天
          </Tag>
          <Text strong style={{ fontSize: 15 }}>{day.date}</Text>
        </div>
      }
      style={{ marginBottom: 20, borderRadius: 12 }}
    >
      <Paragraph style={{ color: '#555' }}>{day.description}</Paragraph>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Text type="secondary">交通：</Text>
          <Tag>{day.transportation}</Tag>
        </Col>
        <Col>
          <Text type="secondary">住宿类型：</Text>
          <Tag>{day.accommodation}</Tag>
        </Col>
      </Row>

      {day.hotel && <HotelCard hotel={day.hotel} />}

      {day.attractions.length > 0 && (
        <>
          <Divider style={{ fontSize: 14, fontWeight: 600 }} orientationMargin={0}>
            🏛️ 景点安排
          </Divider>
          <Row gutter={[12, 12]}>
            {day.attractions.map((attraction, idx) => (
              <Col xs={24} sm={12} key={`${attraction.name}-${idx}`}>
                <AttractionCard
                  item={attraction}
                  index={idx}
                  attractionImages={attractionImages}
                  onImageError={onImageError}
                />
              </Col>
            ))}
          </Row>
        </>
      )}

      {day.meals.length > 0 && (
        <>
          <Divider style={{ fontSize: 14, fontWeight: 600 }} orientationMargin={0}>
            🍽️ 餐饮推荐
          </Divider>
          <Row gutter={[12, 12]}>
            {day.meals.map((meal) => (
              <MealCard key={`${meal.type}-${meal.name}`} meal={meal} />
            ))}
          </Row>
        </>
      )}
    </Card>
  )
}

export default TripDayCard