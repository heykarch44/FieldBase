import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is an authenticated admin/owner
    const supabase = await createClient()
    const {
      data: { user: caller },
    } = await supabase.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get caller's org + role
    const { data: callerMember } = await supabaseAdmin
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', caller.id)
      .single()

    if (
      !callerMember ||
      !['owner', 'admin', 'manager'].includes(callerMember.role)
    ) {
      return NextResponse.json(
        { error: 'Only owners, admins, and managers can add team members' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { email, full_name, role, temp_password } = body

    if (!email || !full_name || !role) {
      return NextResponse.json(
        { error: 'Email, full name, and role are required' },
        { status: 400 }
      )
    }

    // Create the user via Supabase Admin API (skips email confirmation)
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: temp_password || generateTempPassword(),
        email_confirm: true, // Auto-confirm so they can log in immediately
        user_metadata: { full_name },
      })

    if (createError) {
      // If user already exists, try to just add them to the org
      if (
        createError.message?.includes('already been registered') ||
        createError.message?.includes('already exists')
      ) {
        // Find existing user
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', email)
          .single()

        if (existingUser) {
          // Check if already a member
          const { data: existingMember } = await supabaseAdmin
            .from('org_members')
            .select('id')
            .eq('org_id', callerMember.org_id)
            .eq('user_id', existingUser.id)
            .single()

          if (existingMember) {
            return NextResponse.json(
              { error: 'This user is already a member of your organization' },
              { status: 409 }
            )
          }

          // Add to org
          const { error: memberError } = await supabaseAdmin
            .from('org_members')
            .insert({
              org_id: callerMember.org_id,
              user_id: existingUser.id,
              role,
            })

          if (memberError) {
            return NextResponse.json(
              { error: memberError.message },
              { status: 500 }
            )
          }

          // Set their active_org_id if they don't have one
          await supabaseAdmin
            .from('users')
            .update({ active_org_id: callerMember.org_id })
            .eq('id', existingUser.id)
            .is('active_org_id', null)

          return NextResponse.json({
            success: true,
            message: 'Existing user added to your organization',
            user_id: existingUser.id,
          })
        }

        return NextResponse.json(
          { error: createError.message },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      )
    }

    const userId = newUser.user.id

    // The auth trigger will create the public.users row.
    // But it also creates an org if company_name is in metadata.
    // Since we didn't pass company_name, no org is created — good.
    // We just need to add them to the caller's org.

    // Small delay to let the trigger fire
    await new Promise((r) => setTimeout(r, 500))

    // Add the new user to the caller's org
    const { error: memberError } = await supabaseAdmin
      .from('org_members')
      .insert({
        org_id: callerMember.org_id,
        user_id: userId,
        role,
      })

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      )
    }

    // Set their active_org_id
    await supabaseAdmin
      .from('users')
      .update({ active_org_id: callerMember.org_id })
      .eq('id', userId)

    return NextResponse.json({
      success: true,
      message: `${full_name} has been added as ${role}`,
      user_id: userId,
    })
  } catch (err) {
    console.error('create-member error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateTempPassword(): string {
  // Generate a reasonably strong temp password
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
  let pw = ''
  for (let i = 0; i < 12; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pw
}
