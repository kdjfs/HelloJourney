import { Card, Tag, Typography, Row, Col, Divider } from 'antd'
import {
  ClockCircleOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  StarOutlined,
} from '@ant-design/icons'
import type { DayPlan, Attraction, Meal, Hotel } from '../../types/api'
import AttractionImage from '../AttractionImage'
import { useTranslation } from 'react-i18next'

const { Text, Paragraph } = Typography

interface TripDayCardProps {
  day: DayPlan
  attractionImages?: Record<string, string>
}

const mealTypeMap: Record<string, { labelKey: string; color: string }> = {
  breakfast: { labelKey: 'tripDay.breakfast', color: 'orange' },
  lunch: { labelKey: 'tripDay.lunch', color: 'green' },
  dinner: { labelKey: 'tripDay.dinner', color: 'purple' },
  snack: { labelKey: 'tripDay.snack', color: 'gold' },
}

function AttractionCard({
  item,
  index,
  city,
  attractionImages,
}: {
  item: Attraction
  index: number
  city: string
  attractionImages?: Record<string, string>
}) {
  const { t } = useTranslation()
  const imageUrl = attractionImages?.[item.name]
  const hours = Math.floor(item.visit_duration / 60)
  const minutes = item.visit_duration % 60
  const duration = hours === 0
    ? t('common.minutes', { count: minutes })
    : minutes === 0
      ? t('common.hours', { count: hours })
      : t('common.hoursMinutes', { hours, minutes })

  return (
    <Card size="small" className="attraction-card" styles={{ body: { padding: 0 } }}>
      <div className="attraction-image-wrapper">
        <AttractionImage
          attractionName={item.name}
          city={city}
          imageUrl={imageUrl}
          className="attraction-image"
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
          {item.reservation_required && <Tag color="red">{t('tripDay.reservation')}</Tag>}
        </div>

        <Row gutter={[8, 8]}>
          <Col xs={24} sm={8}>
            <Text type="secondary">
              <ClockCircleOutlined /> {duration}
            </Text>
          </Col>
          <Col xs={24} sm={8}>
            <Text type="secondary">
              <DollarOutlined /> {t('tripDay.ticket', { amount: item.ticket_price ?? 0 })}
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
  const { t } = useTranslation()
  return (
    <Card
      size="small"
      title={<span className="hotel-title">{hotel.name}</span>}
      className="hotel-card"
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[8, 8]}>
        <Col xs={12}>
          <Text type="secondary">{t('tripDay.address')}</Text>
          <br />
          <Text>{hotel.address}</Text>
        </Col>
        <Col xs={12}>
          <Text type="secondary">{t('tripDay.type')}</Text>
          <br />
          <Text>{hotel.type}</Text>
        </Col>
        <Col xs={12}>
          <Text type="secondary">{t('tripDay.priceRange')}</Text>
          <br />
          <Text>{hotel.price_range}</Text>
        </Col>
        <Col xs={12}>
          <Text type="secondary">{t('tripDay.rating')}</Text>
          <br />
          <Text><StarOutlined style={{ color: '#faad14' }} /> {hotel.rating}</Text>
        </Col>
        <Col xs={24}>
          <Text type="secondary">{t('tripDay.distance')}</Text>
          <br />
          <Text>{hotel.distance}</Text>
        </Col>
        {hotel.estimated_cost !== undefined && hotel.estimated_cost > 0 && (
          <Col xs={12}>
            <Text type="secondary">{t('tripDay.estimatedCost')}</Text>
            <br />
            <Text><DollarOutlined /> {t('tripDay.perNight', { amount: hotel.estimated_cost })}</Text>
          </Col>
        )}
      </Row>
    </Card>
  )
}

function MealCard({ meal }: { meal: Meal }) {
  const { t } = useTranslation()
  const mealInfo = mealTypeMap[meal.type]
  const mealColor = mealInfo?.color ?? 'default'
  return (
    <Col xs={24} sm={8} key={`${meal.type}-${meal.name}`}>
      <Card size="small" className="meal-card" style={{ height: '100%' }}>
        <Tag color={mealColor} style={{ marginBottom: 8 }}>
          {mealInfo ? t(mealInfo.labelKey) : meal.type}
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
              <DollarOutlined /> {t('tripDay.aboutCost', { amount: meal.estimated_cost })}
            </Text>
          </div>
        )}
      </Card>
    </Col>
  )
}

function TripDayCard({ day, attractionImages }: TripDayCardProps) {
  const { t } = useTranslation()
  return (
    <Card
      className="day-card"
      title={
        <div className="day-header">
          <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>
            {t('common.dayIndex', { day: day.day_index + 1 })}
          </Tag>
          <Text strong style={{ fontSize: 15 }}>{day.date}</Text>
        </div>
      }
      style={{ marginBottom: 20, borderRadius: 14 }}
    >
      <Paragraph>{day.description}</Paragraph>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Text type="secondary">{t('tripDay.transport')}</Text>
          <Tag>{day.transportation}</Tag>
        </Col>
        <Col>
          <Text type="secondary">{t('tripDay.accommodation')}</Text>
          <Tag>{day.accommodation}</Tag>
        </Col>
      </Row>

      {day.hotel && <HotelCard hotel={day.hotel} />}

      {day.attractions.length > 0 && (
        <>
          <Divider style={{ fontSize: 14, fontWeight: 600 }} orientationMargin={0}>
            {t('tripDay.attractions')}
          </Divider>
          <Row gutter={[12, 12]}>
            {day.attractions.map((attraction, idx) => (
              <Col xs={24} sm={12} key={`${attraction.name}-${idx}`}>
                <AttractionCard
                  item={attraction}
                  index={idx}
                  city={day.city || ''}
                  attractionImages={attractionImages}
                />
              </Col>
            ))}
          </Row>
        </>
      )}

      {day.meals.length > 0 && (
        <>
          <Divider style={{ fontSize: 14, fontWeight: 600 }} orientationMargin={0}>
            {t('tripDay.meals')}
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
