import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { documentsAPI, testsAPI, questionsAPI } from '../services/api'
import { FileText, Trash2, Download, Play } from 'lucide-react'

export default function Documents() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await documentsAPI.list()
      setDocuments(response.data)
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this document and all its questions?')) {
      return
    }

    try {
      await documentsAPI.delete(id)
      setDocuments(documents.filter(doc => doc.id !== id))
    } catch (error) {
      alert('Failed to delete document')
    }
  }

  const handleExportAnki = async (documentId, documentTitle) => {
    try {
      // Get document details and questions
      const docResponse = await documentsAPI.get(documentId)
      const questionsResponse = await questionsAPI.getByDocument(documentId)

      if (!questionsResponse.data || questionsResponse.data.length === 0) {
        alert('No questions available for this document')
        return
      }

      // Create a test from all questions
      const testResponse = await testsAPI.create({
        name: `${docResponse.data.title || docResponse.data.filename}`,
        description: 'Auto-generated deck for Anki export',
        question_ids: questionsResponse.data.map(q => q.id)
      })

      // Export to Anki
      const ankiResponse = await testsAPI.exportAnki(testResponse.data.id)

      // Download the file
      const url = window.URL.createObjectURL(new Blob([ankiResponse.data]))
      const link = document.createElement('a')
      link.href = url
      const filename = (docResponse.data.title || documentTitle || 'deck').replace(/[^a-z0-9]/gi, '_')
      link.setAttribute('download', `${filename}.apkg`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert('Failed to export to Anki: ' + (error.response?.data?.detail || error.message))
      console.error(error)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="mt-2 text-gray-600">Manage your uploaded documents and questions</p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
        >
          Upload New Document
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
          <p className="text-gray-600 mb-4">Upload your first document to get started</p>
          <button
            onClick={() => navigate('/upload')}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
          >
            Upload Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
              <div className="flex items-start justify-between mb-4">
                <FileText className="h-10 w-10 text-primary-600" />
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 uppercase">
                  {doc.file_type}
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1 truncate">
                {doc.title || doc.filename}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {doc.num_questions} questions generated
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/test/document/${doc.id}`)}
                  className="flex-1 bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 transition text-sm flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  Practice
                </button>
                {doc.num_questions > 0 && (
                  <button
                    onClick={() => handleExportAnki(doc.id, doc.title || doc.filename)}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                    title="Export to Anki"
                  >
                    <Download size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
