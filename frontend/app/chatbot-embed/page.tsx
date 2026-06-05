'use client';

import { useState, useEffect } from "react"
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth"
import { DashboardLayout } from '@/components/dashboard-layout';
import { useSelector } from "react-redux"
import { RootState } from "@/app/store/store";
import { useRouter } from "next/navigation"

export default function EmbedPage() {
    const router = useRouter()
    const { isAuthenticated } = useAuth(true)
    const user = useSelector((state: RootState) => state.auth.user)
    

  const iframeCode = `<div className='flex items-center justify-center'>
        {" "}
        <iframe
  src="https://fyp-embed-frontend.vercel.app/"
  height="600"
          width="800"

        ></iframe>
      </div>`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (


<DashboardLayout>
    <div className="max-w-2xl mx-auto py-20 px-4">
      <h1 className="text-2xl font-semibold mb-6 text-center">Embed Our Widget</h1>
      
      <div className="flex items-start bg-gray-100 rounded-lg p-4 border border-gray-300">
        <code className="text-sm text-gray-800 overflow-auto break-all w-full">
          {iframeCode}
        </code>
        <Button onClick={handleCopy} variant="outline" size="icon" className="ml-2 shrink-0">
          <Copy className="w-4 h-4" />
        </Button>
      </div>

      {copied && <p className="text-green-600 text-sm mt-2 text-center">Copied to clipboard!</p>}
    </div>


  </DashboardLayout>
  );
}
