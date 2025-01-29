import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface UserData {
  cv: any | null;
  jd: any | null;
  linkedin: any | null;
  portfolio: any | null;
  qa: any | null;
}

export function useUserData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchUserData() {
      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [cvResponse, jdResponse, linkedinResponse, portfolioResponse, qaResponse] = await Promise.all([
          // Fetch CV data
          supabase
            .from('user_cv_json')
            .select('*')
            .eq('id', user.id)
            .maybeSingle(),

          // Fetch JD data
          supabase
            .from('user_jd_json')
            .select('*')
            .eq('id', user.id)
            .maybeSingle(),

          // Fetch LinkedIn data
          supabase
            .from('user_linkedin_json')
            .select('*')
            .eq('id', user.id)
            .maybeSingle(),

          // Fetch Portfolio data
          supabase
            .from('user_portfolio_json')
            .select('*')
            .eq('id', user.id)
            .maybeSingle(),

          // Fetch QA data
          supabase
            .from('user_qa_json')
            .select('*')
            .eq('id', user.id)
            .maybeSingle(),
        ]);

        // Log responses
        console.log('CV Data:', cvResponse.data);
        console.log('JD Data:', jdResponse.data);
        console.log('LinkedIn Data:', linkedinResponse.data);
        console.log('Portfolio Data:', portfolioResponse.data);
        console.log('QA Data:', qaResponse.data);

        // Check for errors (but not for "no rows" errors)
        const errors = [
          cvResponse.error && !cvResponse.error.message.includes('no rows') && { type: 'CV', error: cvResponse.error },
          jdResponse.error && !jdResponse.error.message.includes('no rows') && { type: 'JD', error: jdResponse.error },
          linkedinResponse.error && !linkedinResponse.error.message.includes('no rows') && { type: 'LinkedIn', error: linkedinResponse.error },
          portfolioResponse.error && !portfolioResponse.error.message.includes('no rows') && { type: 'Portfolio', error: portfolioResponse.error },
          qaResponse.error && !qaResponse.error.message.includes('no rows') && { type: 'QA', error: qaResponse.error },
        ].filter((error): error is { type: string; error: any } => Boolean(error));

        if (errors.length > 0) {
          throw new Error(
            `Error fetching data: ${errors.map(e => `${e?.type}: ${e?.error.message}`).join(', ')}`
          );
        }

        if (mounted) {
          // Set all data (use null for missing data)
          setUserData({
            cv: cvResponse.data || null,
            jd: jdResponse.data || null,
            linkedin: linkedinResponse.data || null,
            portfolio: portfolioResponse.data || null,
            qa: qaResponse.data || null,
          });
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch user data');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchUserData();

    return () => {
      mounted = false;
    };
  }, [user?.id]); // Only re-run when user ID changes

  return {
    loading,
    error,
    userData
  };
} 