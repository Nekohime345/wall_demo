import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { ArrowUpRight, Check, Heart, Image as ImageIcon, MessageCircle, Send, X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { Avatar } from './components/ui/avatar'
import { Button } from './components/ui/button'
import { Card, CardContent } from './components/ui/card'

const MAX_LENGTH = 280
const STORAGE_KEY = 'little-wall-posts'
const AUTHOR_STORAGE_KEY = 'little-wall-author'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif']
const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }

function subscribeToAuthor(onChange) {
  window.addEventListener('storage', onChange)
  window.addEventListener('wall-author-change', onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener('wall-author-change', onChange)
  }
}

function getStoredAuthor() {
  return localStorage.getItem(AUTHOR_STORAGE_KEY) || ''
}

function saveAuthor(author) {
  localStorage.setItem(AUTHOR_STORAGE_KEY, author)
  window.dispatchEvent(new Event('wall-author-change'))
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

function readLocalPosts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function relativeTime(date) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 172800) return 'yesterday'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(date))
}

function initials(name) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}

function Post({ post, index }) {
  const [liked, setLiked] = useState(false)
  const time = relativeTime(post.created_at)
  return (
    <article className="post-item animate-rise" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="post-meta"><strong>{post.author || 'Wall visitor'}</strong><time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString()}>{time}</time></div>
      <p className="post-copy">{post.content}</p>
      {post.image_url && <a className="post-image-link" href={post.image_url} target="_blank" rel="noreferrer"><img className="post-image" src={post.image_url} alt={`Photo shared by ${post.author || 'a friend'}`} loading="lazy" /></a>}
      <div className="post-actions">
        <button onClick={() => setLiked((current) => !current)} className={`action-link ${liked ? 'action-liked' : ''}`} aria-label={liked ? 'Unlike this post' : 'Like this post'} aria-pressed={liked}>
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} /> {liked ? 'Liked' : 'Like'}
        </button>
        <span className="post-comment-hint"><MessageCircle size={15} /> Say something kind</span>
      </div>
    </article>
  )
}

export default function App() {
  const author = useSyncExternalStore(subscribeToAuthor, getStoredAuthor, () => '')
  const [message, setMessage] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [posts, setPosts] = useState(() => supabase ? [] : readLocalPosts())
  const [loading, setLoading] = useState(Boolean(supabase))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const [shared, setShared] = useState(false)
  const count = useMemo(() => posts.length, [posts.length])
  const imagePreview = useMemo(() => selectedImage ? URL.createObjectURL(selectedImage) : '', [selectedImage])

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }, [imagePreview])

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    supabase.from('posts').select('id, author, content, image_url, created_at').order('created_at', { ascending: false }).limit(50)
      .then(({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) setError(`${fetchError.message} Check the posts table and its public read policy.`)
        else {
          setPosts((current) => [...new Map([...current, ...(data || [])].map((post) => [post.id, post])).values()]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 50))
          setConnected(true)
        }
        setLoading(false)
      })
    const channel = supabase.channel('wall-posts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, ({ new: post }) => {
      setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)].slice(0, 50))
    }).subscribe((status) => { if (status === 'SUBSCRIBED') setConnected(true) })
    return () => { active = false; supabase.removeChannel(channel) }
  }, [])

  async function sharePost(event) {
    event.preventDefault()
    const content = message.trim()
    if (!author.trim() || !content || submitting) return
    if (selectedImage && !supabase) {
      setError('Connect Supabase to upload photos. Your text-only notes can still be saved in this browser.')
      return
    }
    setSubmitting(true)
    setError('')
    const post = { author: author.trim(), content, image_url: null }
    let succeeded = true
    try {
      if (supabase) {
        if (selectedImage) {
          const imagePath = `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[selectedImage.type]}`
          const { error: uploadError } = await supabase.storage.from('wall-photos').upload(imagePath, selectedImage, {
            cacheControl: '3600', contentType: selectedImage.type, upsert: false,
          })
          if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message} Create a public Supabase Storage bucket named "wall-photos" and run supabase/schema.sql to add its upload policy.`)
          post.image_url = supabase.storage.from('wall-photos').getPublicUrl(imagePath).data.publicUrl
        }
        const { data, error: insertError } = await supabase.from('posts').insert(post).select('id, author, content, image_url, created_at').single()
        if (insertError) { setError(`${insertError.message} Check your Supabase insert policy.`); succeeded = false }
        else setPosts((current) => [data, ...current.filter((item) => item.id !== data.id)].slice(0, 50))
      } else {
        const localPost = { ...post, id: crypto.randomUUID(), created_at: new Date().toISOString() }
        const nextPosts = [localPost, ...readLocalPosts()].slice(0, 50)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPosts))
        setPosts(nextPosts)
      }
    } catch (postError) {
      succeeded = false
      setError(postError instanceof Error ? postError.message : 'Could not share your note. Please try again.')
    } finally {
      setSubmitting(false)
    }
    if (succeeded) {
      setMessage('')
      setSelectedImage(null)
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    }
  }

  return (
    <div className="facebook-wall">
      <header className="wall-topbar">
        <div className="wall-topbar-inner">
          <a href="#wall-home" className="wall-wordmark">wall</a>
          <div className="connection-state" aria-live="polite">
            <span className={`live-dot ${connected ? 'live-dot-on' : ''}`} />
            {supabase ? (connected ? 'Live' : loading ? 'Connecting' : 'Reconnecting') : 'Local preview'}
          </div>
        </div>
      </header>

      <main id="wall-home" className="wall-layout">
        <aside className="profile-sidebar" aria-label="Your wall profile">
          <img className="profile-photo" src="/profile-placeholder.svg" alt="Profile photo placeholder. Replace this image with your own photo." />
          <h1>{author || 'Your name'}</h1>
          <p className="profile-wall-name">wall</p>
          <a className="profile-information" href="#wall-info">Information <ArrowUpRight size={15} /></a>
          <div className="profile-facts" id="wall-info">
            <div><span>Networks</span><strong>Wall friends</strong></div>
            <div><span>Current city</span><strong>On the wall</strong></div>
          </div>
          <p className="sidebar-note">Share an update with everyone on this wall.</p>
        </aside>

        <section className="timeline" aria-label="Wall feed">
          <Card className="composer-card">
            <CardContent className="composer-content">
              <div className="composer-heading">
                <Avatar className="avatar-sky">{author ? initials(author) : '?'}</Avatar>
                <span>What’s on your mind?</span>
              </div>
              <form onSubmit={sharePost}>
                <label className="composer-label" htmlFor="author">Posting as</label>
                <input
                  id="author"
                  className="author-input"
                  type="text"
                  autoComplete="name"
                  maxLength={40}
                  placeholder="Your name"
                  value={author}
                  onChange={(event) => saveAuthor(event.target.value)}
                  required
                />
                <input
                  id="photo-upload"
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    if (!IMAGE_TYPES.includes(file.type)) setError('Choose a JPG, PNG, or GIF image.')
                    else if (file.size > MAX_IMAGE_SIZE) setError('Photos must be 5 MB or smaller.')
                    else { setError(''); setSelectedImage(file) }
                    event.target.value = ''
                  }}
                />
                <div className={`photo-picker ${imagePreview ? 'photo-picker-selected' : ''}`}>
                  {imagePreview ? <>
                    <img src={imagePreview} alt="Selected photo preview" className="photo-preview" />
                    <div className="photo-preview-info"><strong>{selectedImage.name}</strong><span>{(selectedImage.size / 1024 / 1024).toFixed(1)} MB · ready to share</span></div>
                    <button className="remove-photo" type="button" onClick={() => setSelectedImage(null)} aria-label="Remove selected photo"><X size={17} /></button>
                  </> : <label className="photo-picker-label" htmlFor="photo-upload"><ImageIcon size={19} /><strong>Add a photo <span>(optional)</span></strong><small>JPG, PNG, or GIF up to 5 MB</small></label>}
                </div>
                <label className="composer-label message-label" htmlFor="message">Message</label>
                <textarea id="message" className="message-input" rows="3" maxLength={MAX_LENGTH} placeholder="What’s on your mind?" value={message} onChange={(event) => setMessage(event.target.value)} />
                <div className="composer-submit-row">
                  <span className={`character-count ${message.length > MAX_LENGTH - 30 ? 'character-count-near' : ''}`}>{MAX_LENGTH - message.length} characters remaining</span>
                  {error && <p className="form-error" role="alert">{error}</p>}
                  <Button type="submit" disabled={!author.trim() || !message.trim() || submitting} className="share-button">{shared ? <><Check size={17} /> Shared!</> : submitting ? 'Sharing…' : <><span>Share</span><Send size={16} /></>}</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="feed-heading"><h2>Posts</h2><span>{count} {count === 1 ? 'post' : 'posts'}</span></div>
          {posts.length ? <div className="feed-list">{posts.map((post, index) => <Post key={post.id} post={post} index={index} />)}</div> : (
            <div className="empty-wall" aria-live="polite"><MessageCircle size={24} /><strong>{loading ? 'Loading posts…' : 'No posts yet'}</strong><span>{error && !loading ? 'The wall could not load. Check the Supabase setup.' : 'Be the first to share something on this wall.'}</span></div>
          )}
        </section>
      </main>
    </div>
  )
}
