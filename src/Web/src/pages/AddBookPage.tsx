import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createBook, CreateBookRequest } from '../api/books'

function AddBookPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // For demo purposes, using a placeholder household ID
  const householdId = '00000000-0000-0000-0000-000000000001'

  const [formData, setFormData] = useState<CreateBookRequest>({
    title: '',
    subtitle: '',
    authors: '',
    isbn13: '',
    isbn10: '',
    publisher: '',
    publishedYear: undefined,
    notes: ''
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'publishedYear' ? (value ? parseInt(value) : undefined) : value
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      setError('Title is required')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      await createBook(householdId, formData)
      navigate('/library')
    } catch (err) {
      setError('Failed to create book. Is the API running?')
      console.error('Failed to create book:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Add New Book</h1>
        <p className="page-subtitle">
          Add a book to your collection
        </p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        {error && (
          <div style={{ 
            padding: '1rem', 
            marginBottom: '1rem', 
            backgroundColor: '#fee2e2', 
            color: '#dc2626',
            borderRadius: '0.5rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Title <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className="form-input"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter book title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="subtitle" className="form-label">Subtitle</label>
            <input
              type="text"
              id="subtitle"
              name="subtitle"
              className="form-input"
              value={formData.subtitle}
              onChange={handleChange}
              placeholder="Enter subtitle (optional)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="authors" className="form-label">Authors</label>
            <input
              type="text"
              id="authors"
              name="authors"
              className="form-input"
              value={formData.authors}
              onChange={handleChange}
              placeholder="e.g., John Smith, Jane Doe"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="isbn13" className="form-label">ISBN-13</label>
              <input
                type="text"
                id="isbn13"
                name="isbn13"
                className="form-input"
                value={formData.isbn13}
                onChange={handleChange}
                placeholder="978-..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="isbn10" className="form-label">ISBN-10</label>
              <input
                type="text"
                id="isbn10"
                name="isbn10"
                className="form-input"
                value={formData.isbn10}
                onChange={handleChange}
                placeholder="10 digits"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="publisher" className="form-label">Publisher</label>
              <input
                type="text"
                id="publisher"
                name="publisher"
                className="form-input"
                value={formData.publisher}
                onChange={handleChange}
                placeholder="Publisher name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="publishedYear" className="form-label">Year</label>
              <input
                type="number"
                id="publishedYear"
                name="publishedYear"
                className="form-input"
                value={formData.publishedYear || ''}
                onChange={handleChange}
                placeholder="YYYY"
                min="1000"
                max={new Date().getFullYear() + 1}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes" className="form-label">Notes</label>
            <textarea
              id="notes"
              name="notes"
              className="form-input"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any notes about this book..."
              rows={4}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Book'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/library')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddBookPage
