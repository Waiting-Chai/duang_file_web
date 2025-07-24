import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { get, set } from '@/utils/db';

const SettingsPage: React.FC = () => {
  const [dirName, setDirName] = useState<string>('');
  const [autoSave, setAutoSave] = useState<boolean>(false);

  useEffect(() => {
    const loadHandle = async () => {
      const name = await get<string>('downloadPathName');
      const autoSaveEnabled = await get<boolean>('autoSave');
      if (name) {
        setDirName(name);
      }
      if (autoSaveEnabled) {
        setAutoSave(autoSaveEnabled);
      }
    };
    loadHandle();
  }, []);

  const selectDirectory = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      await set('directoryHandle', handle);
      await set('downloadPathName', handle.name);
      setDirName(handle.name);
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Download Directory</h2>
          <p className="text-sm text-gray-500">
            Choose a directory where received files will be saved automatically.
          </p>
          <div className="mt-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Switch id="auto-save" checked={autoSave} onCheckedChange={async (checked: boolean) => { setAutoSave(checked); await set('autoSave', checked); }} />
              <Label htmlFor="auto-save">Auto-save files</Label>
            </div>
            {autoSave && (
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="path">Download Path</Label>
                <div className="flex w-full max-w-sm items-center space-x-2">
                  <Input type="text" id="path" value={dirName} readOnly />
                  <Button onClick={selectDirectory}>Choose Directory</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;