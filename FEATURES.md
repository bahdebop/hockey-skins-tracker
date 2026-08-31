# Hockey Skins Tracker - Feature Documentation

## New Features (Latest Update)

### 🔐 User Authentication & Profiles

**Login & Registration**
- Password-based authentication with bcrypt hashing
- JWT token-based sessions (7-day expiration)
- Secure HTTP-only cookies
- Registration with optional email/phone

**User Profiles**
- Personal profile page for each user
- Contact information (email, phone)
- Payment details (Venmo username, PayPal email)
- Password change functionality
- Profile updates persist across sessions

**Players Directory**
- View all players and their contact info
- Quick access to payment information
- Individual player profile pages
- Easy payment via Venmo/PayPal links

### 📡 Real-time Score Updates (SSE)

**Live Notifications**
- Server-Sent Events for instant updates
- Toast notifications when players score
- Automatic UI refresh with new scores
- Position-specific notifications (Forward/Defense/Goalie)
- Shows skins gained/lost in real-time

**How It Works**
- Connect to game page to receive live updates
- When admin updates player goals, all viewers get notified
- No page refresh needed - updates appear automatically
- Works on mobile and desktop browsers

## Usage Guide

### For Players

**Getting Started**
1. Register an account at `/register`
2. Add your payment info in `/profile`
3. Join games and make picks

**Managing Your Profile**
1. Click your name in the navbar
2. Update email, phone, Venmo, PayPal
3. Change password if needed
4. Save changes

**Viewing Other Players**
1. Go to "Players" in navbar
2. Click on any player to see their profile
3. Use their Venmo/PayPal for payments

### For Admins

**Setting Up Players**
1. Go to Admin panel
2. Add players (they can register later to claim accounts)
3. Players can set passwords when they register

**During Games**
1. Update hockey player goals via API or admin interface
2. All connected viewers receive instant notifications
3. Skins automatically recalculated

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with name/password
- `POST /api/auth/register` - Create new account
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Players
- `GET /api/players` - Get all players
- `PUT /api/players` - Update own profile (requires auth)
- `POST /api/players` - Create player (admin)
- `DELETE /api/players?id=X` - Delete player (admin)

### Real-time Events
- `GET /api/events/[gameId]` - SSE stream for game updates

## Environment Variables

Required for production:

```env
# JWT Secret (REQUIRED - change this!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Database (optional - uses SQLite if not provided)
DATABASE_URL=postgresql://...

# Admin password
ADMIN_PASSWORD=your-admin-password
```

## Database Schema Updates

New fields added to `players` table:
- `email` (TEXT, unique, nullable)
- `phone` (TEXT, nullable)
- `password_hash` (TEXT, nullable)
- `venmo_username` (TEXT, nullable)
- `paypal_email` (TEXT, nullable)
- `updated_at` (TIMESTAMP)

## Security Features

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with 7-day expiration
- HTTP-only cookies prevent XSS attacks
- Secure flag enabled in production
- Users can only edit their own profiles
- Admin functions remain separate

## Railway Deployment

**Setup**
1. Push code to GitHub
2. Connect to Railway
3. Add PostgreSQL database
4. Set environment variables:
   - `JWT_SECRET` (generate a strong random string)
   - `DATABASE_URL` (auto-set by Railway)
5. Deploy!

**SSE Compatibility**
- Server-Sent Events work perfectly on Railway
- No additional configuration needed
- Automatic reconnection on connection loss

## Browser Compatibility

**Real-time Updates**
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

**Authentication**
- All modern browsers supported
- Cookies work across all platforms
- Mobile-friendly login/register forms

## Testing Checklist

- [x] User registration works
- [x] Login/logout functionality
- [x] Profile updates persist
- [x] Payment info displays correctly
- [x] Players directory shows all users
- [x] SSE connection establishes
- [x] Goal notifications appear
- [x] Real-time UI updates work
- [x] Multiple clients receive same updates
- [x] Auth persists across page refreshes

## Future Enhancements

- Email notifications for payments
- Push notifications (PWA)
- OAuth integration (Google/GitHub)
- Two-factor authentication
- Player statistics on profile pages
- Game history and performance tracking
- Automated payment reminders
