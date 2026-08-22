import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import i18n, { LOCALE_STORAGE_KEY } from './index'

beforeEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage('zh')
})

afterEach(async () => {
  await i18n.changeLanguage('zh')
  localStorage.clear()
})

describe('application locale', () => {
  it('switches translated UI immediately and persists the locale', async () => {
    render(<MemoryRouter><NavBar /></MemoryRouter>)

    expect(screen.getByRole('button', { name: '生成计划' })).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '界面语言' }))
    fireEvent.click(await screen.findByText('English'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generate plan' })).toBeInTheDocument()
    })
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(i18n.t('navbar.generate')).toBe('Generate plan')
  })
})
