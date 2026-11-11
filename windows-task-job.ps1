# Task processes inherit this unnamed Windows Job. Its non-inheritable handle
# belongs to the current PowerShell process, so an interrupted invocation also
# reclaims Git/tar helpers. Assignment must succeed before starting children.
function Enter-ScottyTaskJob {
    if ([IntPtr]::Size -ne 8) { throw 'This task helper requires the observed64-bit Windows host.' }
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class Scotty20261111TaskJob {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr CreateJobObjectW(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool SetInformationJobObject(IntPtr job, int type, IntPtr information, uint size);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")]
    static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool CloseHandle(IntPtr handle);
    static IntPtr ownedJob;
    public static void Enter() {
        if (ownedJob != IntPtr.Zero) throw new InvalidOperationException("Task Job already assigned.");
        IntPtr job=CreateJobObjectW(IntPtr.Zero,null);
        if(job==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        IntPtr limits=Marshal.AllocHGlobal(144);
        try {
            Marshal.Copy(new byte[144],0,limits,144);
            Marshal.WriteInt32(limits,16,0x2000);
            if(!SetInformationJobObject(job,9,limits,144))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            if(!AssignProcessToJobObject(job,GetCurrentProcess()))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            ownedJob=job;
            job=IntPtr.Zero;
        } finally {
            Marshal.FreeHGlobal(limits);
            if(job!=IntPtr.Zero) CloseHandle(job);
        }
    }
}
'@
    [Scotty20261111TaskJob]::Enter()
}
