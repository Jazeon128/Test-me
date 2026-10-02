import axios from 'axios'
import { it, expect } from 'vitest'
import api, { tagsAPI } from '../api'

it('serializes notebook_id and supports shared tag details', async () => {
    const previous = api.defaults.adapter
    const urls = []
    api.defaults.adapter = async config => {
        urls.push(axios.getUri(config))
        return { data: [], status: 200, statusText: 'OK', headers: {}, config }
    }
    try {
        await tagsAPI.list(12)
        await tagsAPI.list()
        await tagsAPI.get(4)
        expect(urls).toEqual(['/api/tags/?notebook_id=12', '/api/tags/', '/api/tags/4'])
    } finally {
        api.defaults.adapter = previous
    }
})
