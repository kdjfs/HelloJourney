import { fireEvent, render, screen } from '@testing-library/react'
import AttractionImage from './index'

describe('AttractionImage', () => {
  it('renders a deterministic named placeholder when no verified image exists', () => {
    render(<AttractionImage attractionName="广州塔" city="广州" />)

    expect(screen.getByRole('img', { name: '广州塔暂无已验证景点图片' })).toBeInTheDocument()
    expect(screen.getByText('广州塔')).toBeInTheDocument()
    expect(screen.getByText('广州 · 等待图片补充')).toBeInTheDocument()
    expect(document.querySelector('img')).not.toBeInTheDocument()
  })

  it('falls back to the named placeholder when the remote image fails', () => {
    render(
      <AttractionImage
        attractionName="长隆野生动物园"
        city="广州"
        imageUrl="https://aos-cdn-image.amap.com/chimelong.jpg"
      />,
    )

    fireEvent.error(screen.getByRole('img', { name: '长隆野生动物园' }))

    expect(screen.getByRole('img', { name: '长隆野生动物园暂无已验证景点图片' })).toBeInTheDocument()
    expect(document.querySelector('img')).not.toBeInTheDocument()
  })
})
